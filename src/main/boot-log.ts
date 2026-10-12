import { app, type BrowserWindow, screen } from 'electron';
import { appendFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { cpus, freemem, homedir, release, tmpdir, totalmem, version } from 'os';
import { dirname, join } from 'path';

const BOOT_LOG_NAME = 'lbk-boot-log.txt';
const CHROMIUM_LOG_NAME = 'lbk-chromium-log.txt';
const startedAt = Date.now();

let bootLogPath: string | null = null;

function launcherDir(): string {
  const portableDir = process.env['PORTABLE_EXECUTABLE_DIR'];
  if (portableDir) {
    return portableDir;
  }
  const appImage = process.env['APPIMAGE'];
  if (appImage) {
    return dirname(appImage);
  }
  const bundleIndex = process.execPath.indexOf('.app/');
  if (bundleIndex !== -1) {
    return dirname(process.execPath.slice(0, bundleIndex + 4));
  }
  return dirname(process.execPath);
}

function safeDesktop(): string | null {
  try {
    return app.getPath('desktop');
  } catch {
    return join(homedir(), 'Desktop');
  }
}

function stringify(value: unknown): string {
  if (value instanceof Error) {
    return value.stack ?? `${value.name}: ${value.message}`;
  }
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function bootLog(message: string, ...args: unknown[]): void {
  if (!bootLogPath) {
    return;
  }
  const elapsed = String(Date.now() - startedAt).padStart(6, ' ');
  const extra = args.length > 0 ? ` ${args.map(stringify).join(' ')}` : '';
  try {
    appendFileSync(
      bootLogPath,
      `[${new Date().toISOString()}] +${elapsed}ms ${message}${extra}\n`
    );
  } catch {
    // Nowhere left to report a logging failure
  }
}

function openBootLog(): void {
  const candidates = [launcherDir(), safeDesktop(), homedir(), tmpdir()];
  const failures: string[] = [];
  for (const dir of candidates) {
    if (!dir) {
      continue;
    }
    const path = join(dir, BOOT_LOG_NAME);
    try {
      writeFileSync(path, `=== LBK Launcher boot log ===\n`);
      bootLogPath = path;
      break;
    } catch (error) {
      failures.push(`${path}: ${stringify(error)}`);
    }
  }
  for (const failure of failures) {
    bootLog('Could not write boot log at', failure);
  }
}

function listRecentFiles(dir: string, limit: number): string[] {
  try {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const full = join(entry.parentPath, entry.name);
        return { full, mtime: statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, limit)
      .map(({ full, mtime }) => `${new Date(mtime).toISOString()} ${full}`);
  } catch (error) {
    return [`<unreadable: ${stringify(error)}>`];
  }
}

function logEnvironment(): void {
  bootLog('App version:', app.getVersion(), 'packaged:', app.isPackaged);
  bootLog('Versions:', {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  });
  bootLog('OS:', process.platform, process.arch, release(), version());
  bootLog('CPU:', `${cpus().length}x`, cpus()[0]?.model ?? 'unknown');
  bootLog(
    'RAM (MB): total',
    Math.round(totalmem() / 1048576),
    'free',
    Math.round(freemem() / 1048576)
  );
  bootLog('execPath:', process.execPath);
  bootLog('argv:', process.argv);
  bootLog('cwd:', process.cwd());
  bootLog('env:', {
    PORTABLE_EXECUTABLE_DIR: process.env['PORTABLE_EXECUTABLE_DIR'],
    APPIMAGE: process.env['APPIMAGE'],
    FLATPAK_ID: process.env['FLATPAK_ID'],
    XDG_SESSION_TYPE: process.env['XDG_SESSION_TYPE'],
    GAMESCOPE_WAYLAND_DISPLAY: process.env['GAMESCOPE_WAYLAND_DISPLAY'],
    ELECTRON_RUN_AS_NODE: process.env['ELECTRON_RUN_AS_NODE'],
  });
  for (const name of ['userData', 'temp', 'crashDumps'] as const) {
    try {
      bootLog(`path.${name}:`, app.getPath(name));
    } catch (error) {
      bootLog(`path.${name}: <error>`, error);
    }
  }
  try {
    const dumps = listRecentFiles(app.getPath('crashDumps'), 10);
    bootLog(`Recent crash dumps (${dumps.length}):`);
    for (const dump of dumps) {
      bootLog('  ', dump);
    }
  } catch (error) {
    bootLog('Crash dumps listing failed:', error);
  }
}

function watchWindow(window: BrowserWindow): void {
  const id = window.id;
  bootLog(`Window #${id} created`);
  window.once('ready-to-show', () => bootLog(`Window #${id} ready-to-show`));
  window.on('show', () =>
    bootLog(`Window #${id} show`, window.getBounds(), 'visible:', window.isVisible())
  );
  window.on('hide', () => bootLog(`Window #${id} hide`));
  window.on('unresponsive', () => bootLog(`Window #${id} unresponsive`));
  window.on('closed', () => bootLog(`Window #${id} closed`));

  const contents = window.webContents;
  contents.on('did-start-loading', () => bootLog(`Window #${id} did-start-loading`));
  contents.on('did-finish-load', () => bootLog(`Window #${id} did-finish-load`));
  contents.on('did-fail-load', (_event, code, description, url) =>
    bootLog(`Window #${id} did-fail-load`, { code, description, url })
  );
  contents.on('preload-error', (_event, preloadPath, error) =>
    bootLog(`Window #${id} preload-error`, preloadPath, error)
  );
  contents.on('render-process-gone', (_event, details) =>
    bootLog(`Window #${id} render-process-gone`, details)
  );
}

function watchProcess(): void {
  process.on('uncaughtException', (error) => bootLog('uncaughtException:', error));
  process.on('unhandledRejection', (reason) => bootLog('unhandledRejection:', reason));
  process.on('exit', (code) => bootLog('process exit, code', code));

  app.on('will-finish-launching', () => bootLog('app will-finish-launching'));
  app.on('ready', () => {
    bootLog('app ready');
    try {
      bootLog('GPU feature status:', app.getGPUFeatureStatus());
      bootLog(
        'Displays:',
        screen.getAllDisplays().map((d) => ({ bounds: d.bounds, scale: d.scaleFactor }))
      );
    } catch (error) {
      bootLog('GPU/display info failed:', error);
    }
  });
  app.on('browser-window-created', (_event, window) => watchWindow(window));
  app.on('child-process-gone', (_event, details) =>
    bootLog('child-process-gone', details)
  );
  app.on('render-process-gone', (_event, _contents, details) =>
    bootLog('render-process-gone', details)
  );
  app.on('second-instance', (_event, argv) => bootLog('second-instance', argv));
  app.on('window-all-closed', () => bootLog('app window-all-closed'));
  app.on('before-quit', () => bootLog('app before-quit'));
  app.on('will-quit', () => bootLog('app will-quit'));
  app.on('quit', (_event, exitCode) => bootLog('app quit, exitCode', exitCode));
}

openBootLog();
if (bootLogPath) {
  // Chromium's own log catches GPU/renderer failures that never reach JS
  app.commandLine.appendSwitch('enable-logging', 'file');
  app.commandLine.appendSwitch('log-file', join(dirname(bootLogPath), CHROMIUM_LOG_NAME));
  logEnvironment();
  watchProcess();
  bootLog('boot-log module initialised');
}
