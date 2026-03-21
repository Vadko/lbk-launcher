import { execSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { getAllInstalledSteamGames } from '../game-detector';
import { getSteamPath } from '../game-detector/steam';
import { findSteamAppId } from '../game-launcher';
import { renameFileToTranslit } from '../utils/files';
import { isLinux } from '../utils/platform';

const HOME = os.homedir();
const PREFIX_BASE = path.join(HOME, 'lbk-proton-prefixes');

/**
 * Get Proton registry uninstall keys for Linux + Proton
 */
async function getProtonUninstallKeys(
  prefixPath: string,
  protonPath: string
): Promise<{ hklm: Set<string>; hkcu: Set<string> }> {
  const result = { hklm: new Set<string>(), hkcu: new Set<string>() };

  try {
    const env = {
      ...process.env,
      STEAM_COMPAT_DATA_PATH: prefixPath,
      STEAM_COMPAT_CLIENT_INSTALL_PATH: `${HOME}/.steam/root`,
    };

    // Query HKLM Uninstall keys using Proton
    try {
      execSync(
        `"${protonPath}" run regedit /E /tmp/hklm_uninstall.reg "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall" 2>/dev/null`,
        { env, encoding: 'utf8' }
      );

      // Also try regular SOFTWARE path (32-bit)
      try {
        execSync(
          `"${protonPath}" run regedit /E /tmp/hklm_uninstall32.reg "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall" 2>/dev/null`,
          { env }
        );
      } catch (e) {
        // Skip if not found
      }

      // Parse registry export files
      const parseRegistryFile = (filePath: string, keySet: Set<string>) => {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('[HKEY_') && trimmed.includes('Uninstall\\')) {
              const match = trimmed.match(/\[(.+?)\]/);
              if (match) {
                keySet.add(match[1]);
              }
            }
          }
        } catch (e) {
          // File doesn't exist or can't read
        }
      };

      parseRegistryFile('/tmp/hklm_uninstall.reg', result.hklm);
      parseRegistryFile('/tmp/hklm_uninstall32.reg', result.hklm);
    } catch (e) {
      // Skip if wine regedit fails
    }

    // Query HKCU Uninstall keys using Proton
    try {
      execSync(
        `"${protonPath}" run regedit /E /tmp/hkcu_uninstall.reg "HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall" 2>/dev/null`,
        { env }
      );

      const content = fs.readFileSync('/tmp/hkcu_uninstall.reg', 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('[HKEY_') && trimmed.includes('Uninstall\\')) {
          const match = trimmed.match(/\[(.+?)\]/);
          if (match) {
            result.hkcu.add(match[1]);
          }
        }
      }
    } catch (e) {
      // Skip if wine regedit fails or file doesn't exist
    }

    // Clean up temporary files
    try {
      fs.unlinkSync('/tmp/hklm_uninstall.reg');
      fs.unlinkSync('/tmp/hklm_uninstall32.reg');
      fs.unlinkSync('/tmp/hkcu_uninstall.reg');
    } catch (e) {
      // Ignore cleanup errors
    }
  } catch (e) {
    console.warn('[Proton] Failed to read Proton registry keys:', e);
  }

  return result;
}

/**
 * Check for new Proton Uninstall registry keys after installer run.
 * If new key's DisplayName contains target words, print UninstallString.
 */
async function checkNewProtonUninstallKeys(
  prefixPath: string,
  protonPath: string,
  beforeHKLM: Set<string>,
  beforeHKCU: Set<string>
): Promise<void> {
  try {
    const after = await getProtonUninstallKeys(prefixPath, protonPath);

    const env = {
      ...process.env,
      STEAM_COMPAT_DATA_PATH: prefixPath,
      STEAM_COMPAT_CLIENT_INSTALL_PATH: `${HOME}/.steam/root`,
    };

    const checkProtonKey = (key: string, label: string) => {
      try {
        // Export specific key to temp file using Proton
        const tempFile = `/tmp/proton_key_${Date.now()}.reg`;
        execSync(`"${protonPath}" run regedit /E "${tempFile}" "${key}" 2>/dev/null`, {
          env,
        });

        const content = fs.readFileSync(tempFile, 'utf8');

        // Parse DisplayName and UninstallString from registry export
        const displayNameMatch = content.match(/"DisplayName"="([^"]+)"/);
        const uninstallMatch = content.match(/"UninstallString"="([^"]+)"/);

        const displayName = displayNameMatch ? displayNameMatch[1] : '';
        const name = displayName.toLowerCase();

        if (
          name.includes('українізатор') ||
          name.includes('українською') ||
          name.includes('localization') ||
          name.includes('ukrainizator')
        ) {
          const uninstallString = uninstallMatch ? uninstallMatch[1] : '(not found)';
          console.log(
            `[Proton] New Proton Uninstall registry key detected (${label}):`,
            key
          );
          console.log('[Proton]   DisplayName:', displayName || '(not found)');
          console.log('[Proton]   UninstallString:', uninstallString);
        }

        // Clean up temp file
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {
          // Ignore cleanup errors
        }
      } catch (e) {
        // If key can't be read or doesn't have required values, skip
      }
    };

    // Check new HKLM keys
    for (const key of after.hklm) {
      if (!beforeHKLM.has(key)) {
        checkProtonKey(key, 'HKLM');
      }
    }

    // Check new HKCU keys
    for (const key of after.hkcu) {
      if (!beforeHKCU.has(key)) {
        checkProtonKey(key, 'HKCU');
      }
    }
  } catch (e) {
    console.warn('[Proton] Failed to check new Proton registry keys:', e);
  }
}

/**
 * Ensure Temp directory exists in the prefix
 */
function ensureTempDirectory(prefix: string): void {
  const tempDir = path.join(
    prefix,
    'pfx',
    'drive_c',
    'users',
    'steamuser',
    'AppData',
    'Local',
    'Temp'
  );

  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log(`[Proton] Created Temp directory: ${tempDir}`);
    }
  } catch (e) {
    console.warn(`[Proton] Failed to create Temp directory: ${e}`);
  }
}

/**
 * Find or create Proton prefix for application
 */
export async function findOrCreateProtonPrefix(
  protonPath: string,
  appName: string
): Promise<{ prefix: string; keepPrefix: boolean }> {
  let keepPrefix = false;
  let prefix: string;
  let appId: string | null = null;

  try {
    appId = await findSteamAppId(path.dirname(protonPath));
  } catch (err) {
    console.error('[proton] Error getting Steam AppID:', err);
  }

  if (appId) {
    const steamPath = getSteamPath();
    const compatPrefix = path.join(steamPath || '', 'steamapps', 'compatdata', appId);
    if (steamPath && fs.existsSync(compatPrefix)) {
      keepPrefix = true;
      prefix = compatPrefix;
      console.log(`[proton] Found existing Proton prefix for AppID ${appId}: ${prefix}`);
    } else {
      prefix = path.join(PREFIX_BASE, appName);
      fs.mkdirSync(prefix, { recursive: true });
      console.log(`[proton] No compatdata prefix found, using custom: ${prefix}`);
    }
  } else {
    prefix = path.join(PREFIX_BASE, appName);
    fs.mkdirSync(prefix, { recursive: true });
    console.log(`[proton] No AppID found, using custom prefix: ${prefix}`);
  }

  // Ensure Temp directory exists in the prefix
  ensureTempDirectory(prefix);

  return { prefix, keepPrefix };
}

export function findProtons() {
  if (!isLinux()) return [];

  const steamGames = getAllInstalledSteamGames();
  const result = [] as Array<{ name: string; path: string }>;

  steamGames.forEach((gamePath) => {
    const protonName = path.basename(gamePath);
    const protonNameLower = protonName.toLowerCase();
    if (protonNameLower.includes('proton') && !protonNameLower.includes('beta')) {
      const protonPath = path.join(gamePath, 'proton');
      if (fs.existsSync(protonPath)) {
        result.push({ name: protonName, path: protonPath });
      }
    }
  });

  console.log('[proton] Found protons', result);
  return result;
}

export function runProton({
  protonPath,
  filePath,
  installPath,
}: {
  protonPath: string | undefined;
  filePath: string | undefined;
  installPath?: string;
}): Promise<number | null> {
  if (!isLinux() || !protonPath || !filePath) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    (async () => {
      const enFilePath = renameFileToTranslit(filePath);
      const appName = path
        .basename(enFilePath, '.exe')
        .normalize('NFKD')
        .replace(/[^\w.-]+/g, '_');

      // Find or create Proton prefix
      const { prefix, keepPrefix } = await findOrCreateProtonPrefix(protonPath, appName);

      // Read Proton registry keys before installer launch
      let uninstallKeysBeforeHKLM: Set<string> | undefined;
      let uninstallKeysBeforeHKCU: Set<string> | undefined;

      try {
        const beforeKeys = await getProtonUninstallKeys(prefix, protonPath);
        uninstallKeysBeforeHKLM = beforeKeys.hklm;
        uninstallKeysBeforeHKCU = beforeKeys.hkcu;
        console.log(
          `[Proton] Registry tracking initialized: HKLM: ${beforeKeys.hklm.size} keys, HKCU: ${beforeKeys.hkcu.size} keys`
        );
      } catch (e) {
        console.warn('[Proton] Failed to read Proton registry keys before installer:', e);
      }

      const steamPath = fs.realpathSync(`${HOME}/.steam/root`);

      const env = {
        ...process.env,
        STEAM_COMPAT_DATA_PATH: prefix,
        STEAM_COMPAT_CLIENT_INSTALL_PATH: steamPath,
        STEAM_COMPAT_LIBRARY_PATHS: steamPath,
      };

      // Prepare installer arguments
      const installerArgs = ['run', enFilePath];
      if (installPath) {
        const flags = [
          `/installpath=${installPath}`,
          `/DIR=${installPath}`,
          `/INSTALLDIR=${installPath}`,
        ];
        installerArgs.push(...flags);
      }

      const child = spawn(protonPath, installerArgs, {
        env,
        stdio: 'inherit',
      });

      child.on('exit', async (code) => {
        // Check for new Proton registry keys after installer
        if (uninstallKeysBeforeHKLM && uninstallKeysBeforeHKCU) {
          console.log('[Proton] Checking for new uninstall registry entries...');
          await checkNewProtonUninstallKeys(
            prefix,
            protonPath,
            uninstallKeysBeforeHKLM,
            uninstallKeysBeforeHKCU
          );
        }

        // Clean up prefix folder unless KEEP_PREFIX is set
        if (!keepPrefix && prefix.startsWith(PREFIX_BASE)) {
          setTimeout(() => {
            try {
              fs.rmSync(prefix, { recursive: true, force: true });
            } catch (err) {
              console.error("[proton] Can't delete prefix:", err);
            }
          }, 1000);
        }
        resolve(code);
      });

      child.on('error', (err) => {
        reject(err);
      });
    })();
  });
}
