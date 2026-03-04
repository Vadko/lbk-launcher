import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * CDP port used by our app when launched with --e2e flag.
 * Must match E2E_CDP_PORT in src/main/index.ts.
 */
const CDP_PORT = 19222;

export interface AppInstance {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

function getAppVersion(): string {
  const pkgPath = path.join(__dirname, '../../package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version;
}

function getExecutablePath(): string {
  const version = getAppVersion();
  const releaseDir = path.join(__dirname, '../../release', version);

  if (!fs.existsSync(releaseDir)) {
    throw new Error(
      `Release directory not found: ${releaseDir}. Run "pnpm dist:mac", "pnpm dist:win", or "pnpm dist:linux" first.`,
    );
  }

  switch (process.platform) {
    case 'darwin': {
      const archDir = process.arch === 'arm64' ? 'mac-arm64' : 'mac';
      const appPath = path.join(
        releaseDir,
        archDir,
        'LBK Launcher.app',
        'Contents',
        'MacOS',
        'LBK Launcher',
      );
      if (!fs.existsSync(appPath)) {
        throw new Error(`macOS executable not found at: ${appPath}`);
      }
      return appPath;
    }

    case 'win32': {
      const exePath = path.join(
        releaseDir,
        'win-unpacked',
        'LBK Launcher.exe',
      );
      if (!fs.existsSync(exePath)) {
        throw new Error(`Windows executable not found at: ${exePath}`);
      }
      return exePath;
    }

    case 'linux': {
      const linuxPath = path.join(
        releaseDir,
        'linux-unpacked',
        'lbk-launcher',
      );
      if (!fs.existsSync(linuxPath)) {
        throw new Error(`Linux executable not found at: ${linuxPath}`);
      }
      return linuxPath;
    }

    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

/**
 * Wait for CDP endpoint to become available on the given port.
 * Aborts early if the process exits.
 */
async function waitForCDP(
  port: number,
  timeout: number,
  proc: ChildProcess,
): Promise<void> {
  const start = Date.now();
  let lastError = '';
  let attempts = 0;

  while (Date.now() - start < timeout) {
    // Check if the process has exited
    if (proc.exitCode !== null) {
      throw new Error(
        `Electron process exited with code ${proc.exitCode} before CDP became available`,
      );
    }

    attempts++;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        const data = await response.json();
        console.log(`[CDP] Connected after ${attempts} attempts: ${JSON.stringify(data)}`);
        return;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    // Log progress every 10 attempts
    if (attempts % 10 === 0) {
      console.log(
        `[CDP] Still waiting... attempt=${attempts} elapsed=${Date.now() - start}ms pid=${proc.pid} exitCode=${proc.exitCode} lastError=${lastError}`,
      );
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `CDP on port ${port} not available after ${timeout}ms (${attempts} attempts). Last error: ${lastError}`,
  );
}

/**
 * Launch the packaged Electron app and connect via Chrome DevTools Protocol.
 *
 * Why not _electron.launch()?
 * Playwright's _electron.launch() passes --remote-debugging-port=0 as a CLI arg,
 * but Electron 30+ silently ignores this flag for packaged binaries.
 * Playwright then waits for "DevTools listening on ws://..." on stderr, which
 * never appears, causing a timeout.
 *
 * Instead, we:
 * 1. Spawn the binary with --e2e flag (our app calls appendSwitch to enable CDP)
 * 2. Wait for the CDP endpoint to become available
 * 3. Connect via chromium.connectOverCDP()
 */
export async function launchApp(): Promise<AppInstance> {
  const executablePath = getExecutablePath();
  console.log(`Launching app from: ${executablePath}`);

  // Ensure CDP port is free from a previous run
  await waitForPortFree(CDP_PORT, 15_000);

  const proc = spawn(
    executablePath,
    ['--no-sandbox', '--disable-gpu-sandbox'],
    {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1', LBK_E2E: '1' },
    },
  );

  console.log(`[launch] Spawned process pid=${proc.pid}`);

  // Forward Electron output for debugging (use console.log for CI visibility)
  proc.stderr?.on('data', (data: Buffer) => {
    console.log(`[electron:err] ${data.toString().trimEnd()}`);
  });
  proc.stdout?.on('data', (data: Buffer) => {
    console.log(`[electron:out] ${data.toString().trimEnd()}`);
  });
  proc.on('error', (err) => {
    console.error(`[electron] Spawn error: ${err.message}`);
  });
  proc.on('exit', (code, signal) => {
    console.log(`[electron] Process exited: code=${code} signal=${signal}`);
  });

  // Wait for our app's CDP server (enabled via appendSwitch in src/main/index.ts)
  await waitForCDP(CDP_PORT, 60_000, proc);

  // Connect via CDP
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  const context = browser.contexts()[0];

  // Wait for the main window page to appear (may not be ready immediately)
  let page: Page;
  const deadline = Date.now() + 60_000;
  while (context.pages().length === 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200));
  }
  if (context.pages().length > 0) {
    page = context.pages()[0];
  } else {
    page = await context.waitForEvent('page', { timeout: 10_000 });
  }

  const close = async () => {
    try {
      await browser.close();
    } catch { /* browser already closed */ }
    await killProcess(proc);
  };

  return { browser, context, page, close };
}

/**
 * Wait for the app to finish Supabase sync and show the main UI.
 * The search bar becoming visible means sync is done and the loader is gone.
 */
export async function waitForAppReady(page: Page) {
  await page
    .getByPlaceholder('Пошук гри...')
    .waitFor({ state: 'visible', timeout: 60_000 });
}

/**
 * Wait until the given port is no longer responding (previous process fully exited).
 */
async function waitForPortFree(port: number, timeout: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        // Port is still in use, wait and retry
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
    } catch {
      // Connection refused — port is free
      return;
    }
  }
  console.warn(`[CDP] Port ${port} still in use after ${timeout}ms, proceeding anyway`);
}

async function killProcess(proc: ChildProcess): Promise<void> {
  if (proc.exitCode !== null) return;

  proc.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve();
    }, 5_000);
    proc.on('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
