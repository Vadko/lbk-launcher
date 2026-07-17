/**
 * EA App (EA Desktop) Detection
 *
 * Ported from GameFinder's EADesktop store handler (GPL-3.0):
 * https://github.com/erri120/GameFinder — src/GameFinder.StoreHandlers.EADesktop
 * EA Desktop keeps the installed-games list in an AES-256-CBC encrypted file
 * (`IS`); the key is derived from hardware identifiers, the IV is constant.
 * A folder scan for __Installer/installerdata.xml is used as fallback in case
 * EA changes the encryption scheme.
 */

import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { isWindows } from '../utils/platform';

const EA_ALL_USERS_FOLDER =
  '530c11479fe252fc5aabc24935b9776d4900eb3ba58fdc271e0d6229413ad40e';
const EA_SUPPORTED_SCHEMA_VERSION = 21;

// First 16 bytes of SHA3-256("allUsersGenericId" + "IS") — precomputed in GameFinder
const EA_IS_IV = Buffer.from([
  0x84, 0xef, 0xc4, 0xb8, 0x36, 0x11, 0x9c, 0x20, 0x41, 0x93, 0x98, 0xc3, 0xf3, 0xf2,
  0xbc, 0xef,
]);

interface EAInstallInfo {
  baseInstallPath?: string;
  baseSlug?: string;
  softwareId?: string;
  installCheck?: string;
}

interface EAInstalledGame {
  installDir: string;
  slug: string | null;
  softwareId: string | null;
}

function getEADataFolder(): string {
  const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
  return path.join(programData, 'EA Desktop');
}

/**
 * Query hardware identifiers via a single PowerShell CIM call.
 * Field set and order mirror GameFinder's HardwareInfoProvider exactly.
 */
function getEAHardwareInfo(): Record<string, string> | null {
  const psScript = [
    '$bb = Get-CimInstance -ClassName Win32_BaseBoard | Select-Object -First 1;',
    '$bios = Get-CimInstance -ClassName Win32_BIOS | Select-Object -First 1;',
    '$vc = Get-CimInstance -ClassName Win32_VideoController | Select-Object -First 1;',
    '$cpu = Get-CimInstance -ClassName Win32_Processor | Select-Object -First 1;',
    '$vol = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID=\'C:\'" | Select-Object -First 1;',
    '[PSCustomObject]@{',
    'BaseBoardManufacturer = $bb.Manufacturer;',
    'BaseBoardSerialNumber = $bb.SerialNumber;',
    'BIOSManufacturer = $bios.Manufacturer;',
    'BIOSSerialNumber = $bios.SerialNumber;',
    'VolumeSerialNumber = $vol.VolumeSerialNumber;',
    'VideoControllerDeviceId = $vc.PNPDeviceID;',
    'ProcessorManufacturer = $cpu.Manufacturer;',
    'ProcessorId = $cpu.ProcessorId;',
    'ProcessorName = $cpu.Name;',
    '} | ConvertTo-Json -Compress',
  ].join(' ');

  try {
    const output = execSync(
      `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`,
      { encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'ignore'] }
    );
    return JSON.parse(output.trim());
  } catch (error) {
    console.error('[EA] Error querying hardware info:', error);
    return null;
  }
}

let cachedDecryptionKey: Buffer | null = null;

/**
 * Derive the IS-file decryption key:
 * SHA3-256("allUsersGenericId" + "IS" + SHA1(hardwareString))
 */
function getEADecryptionKey(): Buffer | null {
  if (cachedDecryptionKey) {
    return cachedDecryptionKey;
  }

  const hw = getEAHardwareInfo();
  if (!hw) {
    return null;
  }

  // GetVolumeInformationW formats the serial as "X" (no leading zeros), while
  // WMI pads it to 8 hex chars — strip the padding to match GameFinder's key
  const volumeSerial = (hw.VolumeSerialNumber || '')
    .toUpperCase()
    .replace(/^0+(?=[0-9A-F])/, '');

  const hardwareString =
    `${hw.BaseBoardManufacturer || ''};${hw.BaseBoardSerialNumber || ''};` +
    `${hw.BIOSManufacturer || ''};${hw.BIOSSerialNumber || ''};` +
    `${volumeSerial};${hw.VideoControllerDeviceId || ''};` +
    `${hw.ProcessorManufacturer || ''};${hw.ProcessorId || ''};${hw.ProcessorName || ''};`;

  const hardwareHash = crypto
    .createHash('sha1')
    .update(hardwareString, 'ascii')
    .digest('hex')
    .toLowerCase();

  cachedDecryptionKey = crypto
    .createHash('sha3-256')
    .update(`allUsersGenericIdIS${hardwareHash}`, 'ascii')
    .digest();

  return cachedDecryptionKey;
}

/**
 * Decrypt and parse the EA Desktop IS file. Returns null when the file is
 * missing or the key doesn't match (e.g. hardware changed).
 */
function getGamesFromISFile(): EAInstalledGame[] | null {
  const isFilePath = path.join(getEADataFolder(), EA_ALL_USERS_FOLDER, 'IS');
  if (!fs.existsSync(isFilePath)) {
    return null;
  }

  const key = getEADecryptionKey();
  if (!key) {
    return null;
  }

  try {
    // First 64 bytes hold a hash we don't need — ciphertext starts after it
    const cipherText = fs.readFileSync(isFilePath).subarray(64);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, EA_IS_IV);
    const plainText = Buffer.concat([
      decipher.update(cipherText),
      decipher.final(),
    ]).toString('utf8');

    const parsed = JSON.parse(plainText) as {
      installInfos?: EAInstallInfo[];
      schema?: { version?: number };
    };

    const schemaVersion = parsed.schema?.version;
    if (schemaVersion !== EA_SUPPORTED_SCHEMA_VERSION) {
      console.warn(
        `[EA] IS file schema version ${schemaVersion} differs from supported ${EA_SUPPORTED_SCHEMA_VERSION}`
      );
    }

    const games: EAInstalledGame[] = [];
    for (const info of parsed.installInfos || []) {
      if (info.baseInstallPath && fs.existsSync(info.baseInstallPath)) {
        games.push({
          installDir: info.baseInstallPath.replace(/[\\/]+$/, ''),
          slug: info.baseSlug || null,
          softwareId: info.softwareId || null,
        });
      }
    }

    console.log(`[EA] Found ${games.length} installed games via IS file`);
    if (games.length > 0) {
      console.log(
        `[EA] Games list: ${games.map((g) => path.basename(g.installDir)).join(', ')}`
      );
    }
    return games;
  } catch (error) {
    cachedDecryptionKey = null;
    console.warn(
      '[EA] Failed to decrypt/parse IS file, falling back to folder scan:',
      error
    );
    return null;
  }
}

/**
 * Fallback: scan EA library folders for games (identified by
 * __Installer/installerdata.xml inside the game folder).
 */
function getGamesFromFolderScan(): EAInstalledGame[] {
  const baseDirs = new Set<string>();

  const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
  const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  baseDirs.add(path.join(programFiles, 'EA Games'));
  baseDirs.add(path.join(programFilesX86, 'EA Games'));
  baseDirs.add(path.join(programFiles, 'Electronic Arts'));
  baseDirs.add(path.join(programFilesX86, 'Electronic Arts'));

  // User-chosen install location from EA Desktop settings
  try {
    const machineIniPath = path.join(getEADataFolder(), 'machine.ini');
    if (fs.existsSync(machineIniPath)) {
      const content = fs.readFileSync(machineIniPath, 'utf8');
      const match = content.match(/^user\.downloadinplacedir=(.+)$/m);
      if (match?.[1]) {
        baseDirs.add(match[1].trim().replace(/[\\/]+$/, ''));
      }
    }
  } catch {
    // Safe to ignore
  }

  const games: EAInstalledGame[] = [];
  for (const baseDir of baseDirs) {
    if (!fs.existsSync(baseDir)) {
      continue;
    }
    try {
      for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue;
        }
        const gameDir = path.join(baseDir, entry.name);
        if (fs.existsSync(path.join(gameDir, '__Installer', 'installerdata.xml'))) {
          games.push({ installDir: gameDir, slug: null, softwareId: null });
        }
      }
    } catch {
      // Safe to ignore
    }
  }

  if (games.length > 0) {
    console.log(`[EA] Found ${games.length} installed games via folder scan`);
    console.log(
      `[EA] Games list: ${games.map((g) => path.basename(g.installDir)).join(', ')}`
    );
  }
  return games;
}

function getEAInstalledGames(): EAInstalledGame[] {
  if (!isWindows()) {
    return [];
  }
  return getGamesFromISFile() ?? getGamesFromFolderScan();
}

/**
 * Find EA App game by folder name
 */
export function findEAGame(gameFolderName: string): string | null {
  console.log(`[EA] Searching for game: "${gameFolderName}"`);

  const target = gameFolderName.toLowerCase();
  for (const game of getEAInstalledGames()) {
    if (path.basename(game.installDir).toLowerCase() === target) {
      console.log(`[EA] ✓ Game found: ${game.installDir}`);
      return game.installDir;
    }
  }

  console.warn(`[EA] ✗ Game "${gameFolderName}" not found`);
  return null;
}

/**
 * Get all installed EA App game folder names
 */
export function getInstalledEAGamePaths(): string[] {
  try {
    return getEAInstalledGames().map((game) => path.basename(game.installDir));
  } catch (error) {
    console.error('[EA] Error getting game paths:', error);
    return [];
  }
}
