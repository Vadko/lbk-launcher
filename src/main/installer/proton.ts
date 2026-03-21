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

/**
 * Check if display name contains localization keywords
 */
function isLocalizationApp(displayName: string): boolean {
  const name = displayName.toLowerCase();
  return (
    name.includes('українізатор') ||
    name.includes('українською') ||
    name.includes('localization') ||
    name.includes('ukrainizator')
  );
}

/**
 * Parse registry file for uninstall keys
 */
function parseRegistryFileForUninstallKeys(
  filePath: string,
  hivePrefix: 'HKEY_LOCAL_MACHINE' | 'HKEY_CURRENT_USER'
): Set<string> {
  const keys = new Set<string>();

  if (!fs.existsSync(filePath)) {
    console.warn(`[Proton] Registry file not found: ${filePath}`);
    return keys;
  }

  try {
    // Check file modification time for cache debugging
    const stats = fs.statSync(filePath);
    console.log(`[Proton] Reading registry file: ${filePath}`);
    console.log(`[Proton] File modified: ${stats.mtime.toISOString()}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`[Proton] Registry file size: ${content.length} bytes`);

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Only look for keys that start with the exact paths we want
      const targetPaths = hivePrefix === 'HKEY_LOCAL_MACHINE' 
        ? ['[Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\', '[Software\\\\Wow6432Node\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\']
        : ['[Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\'];
        
      const matchingPath = targetPaths.find(path => trimmed.startsWith(path));
      if (matchingPath) {
        const match = trimmed.match(/^\[(.+?)\]/);
        if (match) {
          const key = match[1];
          const winKey = `${hivePrefix}\\\\SOFTWARE\\\\${key.substring(key.indexOf('Software\\\\') + 9)}`;
          console.log(`[Proton] Valid uninstall key added: ${winKey}`);
          keys.add(winKey);
        }
      }
    }
    console.log(`[Proton] Found ${keys.size} uninstall keys in ${filePath}`);
  } catch (e) {
    console.warn(`[Proton] Failed to read ${path.basename(filePath)}:`, e);
  }

  return keys;
}

/**
 * Get Proton registry uninstall keys by reading registry files directly (fast, no Proton execution)
 */
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

  console.log(`[Proton] Read registry files directly: HKLM: ${result.hklm.size} keys, HKCU: ${result.hkcu.size} keys`);
  return result;
}

/**
 * Parse registry key details from file content
 */
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
      // Check previous key before moving to new one
      const result = checkAndReport();
      if (result) return result;

      // Reset for new key
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

  // Check the last key
  return checkAndReport();
}

/**
 * Wait for registry files to be updated by monitoring file size changes
 */
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
    const checkInterval = 100; // Check every 100ms
    
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
        
        // Check if files changed or timeout reached
        if (systemSize !== initialSystemSize || userSize !== initialUserSize || 
            Date.now() - startTime >= maxWaitMs) {
          console.log(`[Proton] Registry files changed: system ${initialSystemSize}→${systemSize}, user ${initialUserSize}→${userSize}`);
          resolve();
          return;
        }
        
        // Continue checking
        setTimeout(checkSizes, checkInterval);
      } catch (e) {
        console.warn('[Proton] Error checking registry file sizes:', e);
        resolve(); // Resolve anyway to avoid hanging
      }
    };
    
    checkSizes();
  });
}

/**
 * Check for new Proton Uninstall registry keys by reading registry files directly (fast, no Proton execution).
 * If new key's DisplayName contains target words, print UninstallString.
 */
function checkNewProtonUninstallKeys(
  prefixPath: string,
  beforeHKLM: Set<string>,
  beforeHKCU: Set<string>
): void {
  try {
    console.log(`[Proton] Checking for new uninstall keys in prefix: ${prefixPath}`);
    const after = getProtonUninstallKeys(prefixPath);

    const checkKeyInFile = (regFilePath: string, key: string, label: string) => {
      try {
        if (!fs.existsSync(regFilePath)) {
          console.warn(`[Proton] Registry file not found: ${regFilePath}`);
          return;
        }

        console.log(`[Proton] Checking key in file: ${key} (${label})`);
        const content = fs.readFileSync(regFilePath, 'utf8');
        const details = parseKeyDetails(content, key);

        if (details) {
          console.log(`[Proton] New Proton Uninstall registry key detected (${label}):`, key);
          console.log('[Proton]   DisplayName:', details.displayName);
          console.log('[Proton]   UninstallString:', details.uninstallString || '(not found)');
        }
      } catch (e) {
        console.warn(`[Proton] Failed to check key in file ${regFilePath}:`, e);
      }
    };

    const systemRegPath = path.join(prefixPath, 'pfx', 'system.reg');
    const userRegPath = path.join(prefixPath, 'pfx', 'user.reg');

    console.log(`[Proton] System registry path: ${systemRegPath}`);
    console.log(`[Proton] User registry path: ${userRegPath}`);

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

      // Find or create Proton prefix
      const { prefix, keepPrefix } = await findOrCreateProtonPrefix(protonPath, appName);

      // Read Proton registry files directly (fast, no Proton execution needed)
      let uninstallKeysBeforeHKLM: Set<string> | undefined;
      let uninstallKeysBeforeHKCU: Set<string> | undefined;
      let initialSystemRegSize = 0;
      let initialUserRegSize = 0;

      // Start registry file reading in background (don't await)
      const registryTrackingPromise = Promise.resolve(getProtonUninstallKeys(prefix))
        .then((beforeKeys) => {
          uninstallKeysBeforeHKLM = beforeKeys.hklm;
          uninstallKeysBeforeHKCU = beforeKeys.hkcu;
          
          // Store initial file sizes for change detection
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
            console.warn('[Proton] Failed to get initial registry file sizes:', e);
          }
          
          console.log(
            `[Proton] Registry tracking initialized: HKLM: ${beforeKeys.hklm.size} keys, HKCU: ${beforeKeys.hkcu.size} keys`
          );
        })
        .catch((e) => {
          console.warn('[Proton] Failed to read Proton registry files before installer:', e);
        });

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
        // Check for new registry entries by reading files directly (fast, no Proton execution)
        try {
          await registryTrackingPromise; // Wait for initial file reading to complete
          if (uninstallKeysBeforeHKLM && uninstallKeysBeforeHKCU) {
            console.log('[Proton] Checking for new uninstall registry entries...');
            // Store keys in local constants to avoid TypeScript undefined issues in async callback
            const hklmKeys = uninstallKeysBeforeHKLM;
            const hkcuKeys = uninstallKeysBeforeHKCU;
            
            // Wait for registry files to change instead of fixed timeout
            try {
              console.log('[Proton] Waiting for Wine registry files to be updated...');
              waitForRegistryFileChanges(prefix, initialSystemRegSize, initialUserRegSize)
                .then(() => {
                  checkNewProtonUninstallKeys(prefix, hklmKeys, hkcuKeys);
                })
                .catch(e => {
                  console.warn('[Proton] Failed to check new registry keys:', e);
                });
            } catch (e) {
              console.warn('[Proton] Failed to wait for registry changes:', e);
            }
          }
        } catch (e) {
          console.warn('[Proton] Skipping registry check due to tracking failure:', e);
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
