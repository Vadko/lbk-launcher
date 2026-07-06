import { execSync, spawn } from 'child_process';
import { app } from 'electron';
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

function getLatestProtonLog(logDir: string): string | null {
  try {
    const logs = fs
      .readdirSync(logDir)
      .filter((f) => f.startsWith('steam-') && f.endsWith('.log'))
      .map((f) => path.join(logDir, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return logs[0] ?? null;
  } catch {
    return null;
  }
}

// Point to the full Proton log; on failure also surface the notable lines
// (skipping the verbose unwind/relay trace spam).
function logProtonOutcome(logDir: string, code: number | null): void {
  try {
    const logFile = getLatestProtonLog(logDir);
    if (!logFile) {
      return;
    }
    console.log(`[Proton log] ${logFile}`);
    if (code !== 0) {
      const notable = fs
        .readFileSync(logFile, 'utf8')
        .split('\n')
        .filter((l) => /err:|:warn:|fixme:|exception|fork|fail/i.test(l))
        .slice(-40);
      if (notable.length) {
        console.error(`[Proton log] notable:\n${notable.join('\n')}`);
      }
    }
  } catch (err) {
    console.warn('[Proton] Failed to read Proton log:', err);
  }
}

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

// umu-run launches Proton in-process (no flatpak-spawn host escape), so its window
// is a normal client — the only way it renders under gamescope Game Mode. Bundled
// via extraResources (like 7z): prod reads it from resourcesPath, dev from the
// repo's resources/. The Flatpak extracts the same AppImage resources. Falls back
// to a system-installed umu-run.
function resolveUmuRun(): string | null {
  const base = app.isPackaged
    ? path.join(process.resourcesPath || path.join(app.getAppPath(), '..'), 'umu')
    : path.join(app.getAppPath(), 'resources', 'umu');
  const bundled = path.join(base, 'umu-run');
  if (fs.existsSync(bundled)) return bundled;
  try {
    return execSync('command -v umu-run', { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

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

async function findOrCreateProtonPrefix(
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

  // Default to the highest numbered Proton; Experimental/Hotfix (no number) last.
  const version = (name: string) =>
    Number.parseFloat(name.match(/\d+(\.\d+)?/)?.[0] ?? '0');
  result.sort((a, b) => version(b.name) - version(a.name));

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

      // Proton writes its log into the prefix (mounted RW inside the container).
      const protonLogDir = path.join(prefix, 'lbk-logs');
      try {
        fs.mkdirSync(protonLogDir, { recursive: true });
      } catch {
        // Best-effort — logging must never block the install.
      }

      const protonEnv: Record<string, string> = {
        STEAM_COMPAT_DATA_PATH: prefix,
        STEAM_COMPAT_CLIENT_INSTALL_PATH: steamPath,
        PROTON_LOG: '1',
        PROTON_LOG_DIR: protonLogDir,
      };

      // Prefer umu-run (in-sandbox) — required for the installer window to render
      // under gamescope in Flatpak. Fall back to launching Proton directly, which
      // works on the native AppImage where umu isn't available.
      const umuRun = resolveUmuRun();
      let cmd: string;
      let cmdArgs: string[];
      if (umuRun) {
        cmd = umuRun;
        cmdArgs = [enFilePath, ...(args ?? [])];
        Object.assign(protonEnv, {
          PROTONPATH: path.dirname(protonPath),
          WINEPREFIX: prefix,
          GAMEID: 'umu-0',
          PROTON_VERB: 'run',
          UMU_RUNTIME_UPDATE: '0',
        });
      } else {
        cmd = protonPath;
        cmdArgs = ['run', enFilePath, ...(args ?? [])];
      }

      // Steam launches us with its host overlay/runtime vars; they leak into
      // umu and break pressure-vessel (wrong-ELF LD_PRELOAD, host /usr/lib/steam
      // mounts). Drop them so umu sets up its own runtime. NB: keep
      // LD_LIBRARY_PATH — inside the flatpak it points at the gamescope libs.
      const env: NodeJS.ProcessEnv = { ...process.env, ...protonEnv };
      for (const k of ['LD_PRELOAD', 'STEAM_RUNTIME', 'STEAM_COMPAT_MOUNTS']) {
        delete env[k];
      }

      const child = spawn(cmd, cmdArgs, {
        env,
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      child.stdout?.on('data', (data) => {
        console.log(`[Proton stdout] ${data.toString().trimEnd()}`);
      });
      child.stderr?.on('data', (data) => {
        console.error(`[Proton stderr] ${data.toString().trimEnd()}`);
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

        logProtonOutcome(protonLogDir, code);

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
