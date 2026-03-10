import { spawn } from 'child_process';
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
}: {
  protonPath: string | undefined;
  filePath: string | undefined;
}): Promise<number | null> {
  if (!isLinux() || !protonPath || !filePath) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    (async () => {
      let keep_prefix = false;
      const enFilePath = renameFileToTranslit(filePath);
      const appName = path
        .basename(enFilePath, '.exe')
        .normalize('NFKD')
        .replace(/[^\w.-]+/g, '_');

      // 1. Спроба знайти стандартний префікс Proton за Steam AppID
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
          keep_prefix = true;
          prefix = compatPrefix;
          console.log(
            `[proton] Found existing Proton prefix for AppID ${appId}: ${prefix}`
          );
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

      const env = {
        ...process.env,

        // Префікс
        STEAM_COMPAT_DATA_PATH: prefix,
        STEAM_COMPAT_CLIENT_INSTALL_PATH: `${HOME}/.steam/root`,

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

      child.on('exit', (code) => {
        // Clean up prefix folder unless KEEP_PREFIX is set
        if (!keep_prefix && prefix.startsWith(PREFIX_BASE)) {
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
