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

// TODO: Registry functionality - commented out for future implementation
/*
function isLocalizationApp(displayName: string): boolean {
  const name = displayName.toLowerCase();
  return (
    name.includes('українізатор') ||
    name.includes('українською') ||
    name.includes('localization') ||
    name.includes('ukrainizator')
  );
}
*/

/*
function parseRegistryFileForUninstallKeys(
  filePath: string,
  hivePrefix: 'HKEY_LOCAL_MACHINE' | 'HKEY_CURRENT_USER'
): Set<string> {
  const keys = new Set<string>();

  if (!fs.existsSync(filePath)) {
    return keys;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      
      const targetPaths = hivePrefix === 'HKEY_LOCAL_MACHINE' 
        ? ['[Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\', '[Software\\\\Wow6432Node\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\']
        : ['[Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\'];
        
      const matchingPath = targetPaths.find(path => trimmed.startsWith(path));
      if (matchingPath) {
        const match = trimmed.match(/^\[(.+?)\]/);
        if (match) {
          const key = match[1];
          const winKey = `${hivePrefix}\\\\SOFTWARE\\\\${key.substring(key.indexOf('Software\\\\') + 9)}`;
          keys.add(winKey);
        }
      }
    }
  } catch (e) {
    // Error handling
  }

  return keys;
}
*/

/*
function getProtonUninstallKeys(
  prefixPath: string
): { hklm: Set<string>; hkcu: Set<string> } {
  const result = {
    hklm: parseRegistryFileForUninstallKeys(
      path.join(prefixPath, 'pfx', 'system.reg'),
      'HKEY_LOCAL_MACHINE'
    ),
    hkcu: parseRegistryFileForUninstallKeys(
      path.join(prefixPath, 'pfx', 'user.reg'),
      'HKEY_CURRENT_USER'
    )
  };

  return result;
}
*/

/*
function parseKeyDetails(
  content: string,
  targetKey: string
): { displayName: string; uninstallString: string } | null {
  const lines = content.split('\n');
  let currentKey = '';
  let displayName = '';
  let uninstallString = '';
  let inTargetKey = false;

  const checkAndReport = () => {
    if (inTargetKey && displayName && isLocalizationApp(displayName)) {
      return { displayName, uninstallString };
    }
    return null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const result = checkAndReport();
      if (result) return result;

      currentKey = trimmed.slice(1, -1);
      inTargetKey = currentKey.includes('Uninstall\\') && 
                   (currentKey.includes(targetKey.replace('HKEY_LOCAL_MACHINE\\SOFTWARE\\', '')) ||
                    currentKey.includes(targetKey.replace('HKEY_CURRENT_USER\\SOFTWARE\\', '')));
      displayName = '';
      uninstallString = '';
    } else if (inTargetKey) {
      if (trimmed.startsWith('"DisplayName"=')) {
        const match = trimmed.match(/"DisplayName"="([^"]+)"/);
        if (match) displayName = match[1];
      } else if (trimmed.startsWith('"UninstallString"=')) {
        const match = trimmed.match(/"UninstallString"="([^"]+)"/);
        if (match) uninstallString = match[1];
      }
    }
  }

  return checkAndReport();
}
*/

/*
function waitForRegistryFileChanges(
  prefixPath: string,
  initialSystemSize: number,
  initialUserSize: number,
  maxWaitMs: number = 5000
): Promise<void> {
  return new Promise((resolve) => {
    const systemRegPath = path.join(prefixPath, 'pfx', 'system.reg');
    const userRegPath = path.join(prefixPath, 'pfx', 'user.reg');
    
    const startTime = Date.now();
    const checkInterval = 100;
    
    const checkSizes = () => {
      try {
        let systemSize = initialSystemSize;
        let userSize = initialUserSize;
        
        if (fs.existsSync(systemRegPath)) {
          systemSize = fs.statSync(systemRegPath).size;
        }
        if (fs.existsSync(userRegPath)) {
          userSize = fs.statSync(userRegPath).size;
        }
        
        if (systemSize !== initialSystemSize || userSize !== initialUserSize || 
            Date.now() - startTime >= maxWaitMs) {
          resolve();
          return;
        }
        
        setTimeout(checkSizes, checkInterval);
      } catch (e) {
        resolve();
      }
    };
    
    checkSizes();
  });
}
*/

/*
function checkNewProtonUninstallKeys(
  prefixPath: string,
  beforeHKLM: Set<string>,
  beforeHKCU: Set<string>
): void {
  try {
    const after = getProtonUninstallKeys(prefixPath);

    const checkKeyInFile = (regFilePath: string, key: string, label: string) => {
      try {
        if (!fs.existsSync(regFilePath)) {
          return;
        }

        const content = fs.readFileSync(regFilePath, 'utf8');
        const details = parseKeyDetails(content, key);

        if (details) {
          console.log(`[Proton] New Proton Uninstall registry key detected (${label}):`, key);
          console.log('[Proton]   DisplayName:', details.displayName);
          console.log('[Proton]   UninstallString:', details.uninstallString || '(not found)');
        }
      } catch (e) {
        // Error handling
      }
    };

    const systemRegPath = path.join(prefixPath, 'pfx', 'system.reg');
    const userRegPath = path.join(prefixPath, 'pfx', 'user.reg');

    for (const key of after.hklm) {
      if (!beforeHKLM.has(key)) {
        checkKeyInFile(systemRegPath, key, 'HKLM');
      }
    }
    for (const key of after.hkcu) {
      if (!beforeHKCU.has(key)) {
        checkKeyInFile(userRegPath, key, 'HKCU');
      }
    }
  } catch (e) {
    // Error handling
  }
}
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
    }
  } catch (e) {
    // Error creating temp directory
  }
}

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
    // Error getting Steam AppID
  }

  if (appId) {
    const steamPath = getSteamPath();
    const compatPrefix = path.join(steamPath || '', 'steamapps', 'compatdata', appId);
    if (steamPath && fs.existsSync(compatPrefix)) {
      keepPrefix = true;
      prefix = compatPrefix;
    } else {
      prefix = path.join(PREFIX_BASE, appName);
      fs.mkdirSync(prefix, { recursive: true });
    }
  } else {
    prefix = path.join(PREFIX_BASE, appName);
    fs.mkdirSync(prefix, { recursive: true });
  }

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

  return result;
}

export function runProton({
  protonPath,
  filePath,
  args,
}: {
  protonPath: string | undefined;
  filePath: string | undefined;
  args?: string[];
}): Promise<number | null> {
  if (!isLinux() || !protonPath || !filePath) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    (async () => {
      const enFilePath = renameFileToTranslit(filePath);
      const appName = path
        .basename(enFilePath, '.exe')
        .normalize('NFKD')
        .replace(/[^\w.-]+/g, '_');

      const { prefix, keepPrefix } = await findOrCreateProtonPrefix(protonPath, appName);

      // TODO: Registry tracking functionality commented out for future implementation
      /*
      let uninstallKeysBeforeHKLM: Set<string> | undefined;
      let uninstallKeysBeforeHKCU: Set<string> | undefined;
      let initialSystemRegSize = 0;
      let initialUserRegSize = 0;

      const registryTrackingPromise = Promise.resolve(getProtonUninstallKeys(prefix))
        .then((beforeKeys) => {
          uninstallKeysBeforeHKLM = beforeKeys.hklm;
          uninstallKeysBeforeHKCU = beforeKeys.hkcu;
          
          const systemRegPath = path.join(prefix, 'pfx', 'system.reg');
          const userRegPath = path.join(prefix, 'pfx', 'user.reg');
          
          try {
            if (fs.existsSync(systemRegPath)) {
              initialSystemRegSize = fs.statSync(systemRegPath).size;
            }
            if (fs.existsSync(userRegPath)) {
              initialUserRegSize = fs.statSync(userRegPath).size;
            }
          } catch (e) {
            // Error handling
          }
        })
        .catch((e) => {
          // Error handling
        });
      */

      const steamPath = fs.realpathSync(`${HOME}/.steam/root`);

      const env = {
        ...process.env,
        STEAM_COMPAT_DATA_PATH: prefix,
        STEAM_COMPAT_CLIENT_INSTALL_PATH: steamPath,
        STEAM_COMPAT_LIBRARY_PATHS: steamPath,
        STEAM_ROOT_PATH: `Z:${steamPath.replace(/\//g, '\\')}`
      };

      const installerArgs = ['run', enFilePath, ...(args || [])];
      const child = spawn(protonPath, installerArgs, {
        env,
        stdio: 'inherit',
      });

      child.on('exit', async (code) => {
        // TODO: Registry checking functionality commented out for future implementation
        /*
        try {
          await registryTrackingPromise;
          if (uninstallKeysBeforeHKLM && uninstallKeysBeforeHKCU) {
            const hklmKeys = uninstallKeysBeforeHKLM;
            const hkcuKeys = uninstallKeysBeforeHKCU;
            
            try {
              waitForRegistryFileChanges(prefix, initialSystemRegSize, initialUserRegSize)
                .then(() => {
                  checkNewProtonUninstallKeys(prefix, hklmKeys, hkcuKeys);
                })
                .catch(e => {
                  // Error handling
                });
            } catch (e) {
              // Error handling
            }
          }
        } catch (e) {
          // Error handling
        }
        */

        if (!keepPrefix && prefix.startsWith(PREFIX_BASE)) {
          setTimeout(() => {
            try {
              fs.rmSync(prefix, { recursive: true, force: true });
            } catch (err) {
              // Error cleaning up prefix
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
