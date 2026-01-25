import { spawn } from 'child_process';
import CyrillicToTranslit from 'cyrillic-to-translit-js';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { getAllInstalledSteamGames } from '../game-detector';
import { isLinux } from '../utils/platform';

const HOME = os.homedir();
const PREFIX_BASE = path.join(HOME, 'lbk-proton-prefixes');
const KEEP_PREFIX = false;
const translitUk = CyrillicToTranslit({ preset: 'uk' });

export function findProtons() {
  if (!isLinux()) return [];

  const steamGames = getAllInstalledSteamGames();
  const result = [] as Array<{ name: string; path: string }>;

  steamGames.forEach((gamePath) => {
    const gameName = path.basename(gamePath);
    if (gameName.toLowerCase().includes('proton')) {
      const protonPath = path.join(gamePath, 'proton');
      if (fs.existsSync(protonPath)) {
        result.push({ name: gameName, path: protonPath });
      }
    }
  });

  console.log('[proton] Found protons', result);
  return result;
}

function renameFileToTranslit(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.error(`[proton] File not found: ${filePath}`);
  }

  try {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    const transliterated = translitUk.transform(baseName);
    const newPath = path.join(dir, transliterated + ext);
    fs.renameSync(filePath, newPath);

    return newPath;
  } catch (error) {
    console.error(`[proton] Rename file has error: ${filePath}`);
    return filePath;
  }
}

export function runProton({
  protonPath,
  filePath,
}: {
  protonPath: string | undefined;
  filePath: string | undefined;
}): Promise<number | null> {
  if (!isLinux() || !protonPath || !filePath) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const enFilePath = renameFileToTranslit(filePath);
    const appName = path
      .basename(enFilePath, '.exe')
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '_');

    const prefix = path.join(PREFIX_BASE, appName);
    fs.mkdirSync(prefix, { recursive: true });

    const env = {
      ...process.env,

      // Префікс
      STEAM_COMPAT_DATA_PATH: prefix,
      STEAM_COMPAT_CLIENT_INSTALL_PATH: `${HOME}/.steam/root`,

      // Детальний лог Proton
      STEAM_COMPAT_DEBUG: '1',
      WINEDEBUG: '+timestamp,+pid,+seh,+loaddll,+process',

      // Запис логів у файл
      PROTON_LOG: '1',

      // Вимкнення 3D / DX / Vulkan
      PROTON_USE_WINED3D: '1',
      PROTON_NO_D3D11: '1',
      PROTON_NO_D3D10: '1',
      PROTON_NO_D3D9: '1',
      PROTON_NO_ESYNC: '1',
      PROTON_NO_FSYNC: '1',

      // Вимкнення Vulkan
      VK_ICD_FILENAMES: '/dev/null',
    };

    const child = spawn(protonPath, ['run', enFilePath], {
      env,
      stdio: 'inherit',
    });

    child.stdout?.once('data', () => console.log('[proton] Started'));
    child.stderr?.once('data', () => console.log('[proton] Started'));

    child.on('exit', (code) => {
      // Clean up prefix folder unless KEEP_PREFIX is set
      if (!KEEP_PREFIX) {
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
  });
}
