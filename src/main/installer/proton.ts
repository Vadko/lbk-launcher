import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getAllInstalledSteamGames } from '../game-detector';
import { isLinux } from '../utils/platform';

const HOME = os.homedir();
const PREFIX_BASE = isLinux() ? path.join(HOME, 'lbk-proton-prefixes') : '';
const KEEP_PREFIX = false;
const STEAM_COMMON = isLinux() ? `${HOME}/.steam/steam/steamapps/common` : '';
const STEAM_COMPAT_TOOLS = isLinux() ? `${HOME}/.steam/root/compatibilitytools.d` : '';

/* ------------ Proton discovery ------------ */
export function findProtons() {
  if (!isLinux()) return [];

  console.log(getAllInstalledSteamGames());
  const result = [] as Array<{ name: string; path: string | undefined }>;

  function scan(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const proton = path.join(dir, name, 'proton');
      if (fs.existsSync(proton)) {
        result.push({ name, path: proton });
      }
    }
  }

  scan(STEAM_COMMON);
  scan(STEAM_COMPAT_TOOLS);
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
    const appName = path
      .basename(filePath, '.exe')
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '_');

    const prefix = path.join(PREFIX_BASE, appName);
    fs.mkdirSync(prefix, { recursive: true });

    const env = {
      ...process.env,
      STEAM_COMPAT_DATA_PATH: prefix,
      STEAM_COMPAT_CLIENT_INSTALL_PATH: `${HOME}/.steam/root`,
    };

    const child = spawn(protonPath, ['run', filePath], {
      env,
      stdio: 'inherit',
    });

    child.on('exit', (code) => {
      // Clean up prefix folder unless KEEP_PREFIX is set
      if (!KEEP_PREFIX && code === 0) {
        fs.rmSync(prefix, { recursive: true, force: true });
      }
      resolve(code);
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}
