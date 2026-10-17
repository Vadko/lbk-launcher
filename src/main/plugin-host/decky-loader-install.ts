import { spawn } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { getCleanEnv } from '@/main/installer/archive';
import { publishPluginHostState } from '@/main/millennium-install';
import { downloadVerified, MillenniumFetchError } from '@/main/millennium-install/fetch';
import { watchDeckyPlugins } from '@/main/plugin-host/decky-watcher';
import {
  deckyLoaderStateFor,
  getHostSnapshot,
  resetHostFacts,
  setDeckyLoaderInstalling,
} from '@/main/plugin-host/state';
import { syncBridgePluginSetup } from '@/main/utils/cef-flag-file';
import {
  type DeckyInfo,
  deckyCacheDirFor,
  detectDecky,
  resetDeckyDetectCache,
} from '@/main/utils/decky';
import type { DeckyLoaderInstallResult } from '@/shared/types';

// Decky's own installer, pinned like Millennium; it downloads the latest PluginLoader release itself.
const DECKY_INSTALLER = {
  version: '1.9.0',
  url: 'https://github.com/SteamDeckHomebrew/decky-installer/releases/download/v1.9.0/user_install_script.sh',
  sha256: 'e2e2a3638de903225aba0dbc9ce12d916093fcb79c51aa0f0d2d8d332d832550',
  size: 9750,
};

// The user may sit on the password prompt; past this LBK stops waiting but never kills a root install.
const RUN_TIMEOUT_MS = 30 * 60 * 1000;
const SETTLE_MS = 15_000;
const POLL_MS = 1000;
const OUTPUT_TAIL = 4096;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function lastOutputLine(output: string): string | null {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1].slice(0, 300) : null;
}

function runOnHost(script: string): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = process.env.FLATPAK_ID
      ? spawn('flatpak-spawn', ['--host', 'bash', script], {
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      : spawn('bash', [script], {
          env: getCleanEnv(),
          stdio: ['ignore', 'pipe', 'pipe'],
        });
    let output = '';
    const keep = (chunk: Buffer) => {
      output = (output + chunk.toString('utf8')).slice(-OUTPUT_TAIL);
    };
    child.stdout?.on('data', keep);
    child.stderr?.on('data', keep);
    const timer = setTimeout(() => resolve({ code: null, output }), RUN_TIMEOUT_MS);
    timer.unref();
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ code: null, output: `${output}\n${error.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

// The script's exit code says nothing: it re-runs itself under sudo and always exits 1 afterwards.
async function waitForDecky(): Promise<DeckyInfo | null> {
  const deadline = Date.now() + SETTLE_MS;
  let decky: DeckyInfo | null = null;
  do {
    resetDeckyDetectCache();
    decky = await detectDecky().catch(() => null);
    if (decky?.running) {
      return decky;
    }
    await sleep(POLL_MS);
  } while (Date.now() < deadline);
  return decky?.installed ? decky : null;
}

async function runInstall(): Promise<DeckyLoaderInstallResult> {
  const snapshot = await getHostSnapshot();
  if (snapshot.decky?.installed && snapshot.decky.running) {
    return { success: true };
  }
  const offer = deckyLoaderStateFor(snapshot);
  if (!offer) {
    return { success: false, reason: 'unsupported' };
  }
  if (offer.blockedBy === 'game-mode') {
    return { success: false, reason: 'game-mode' };
  }

  setDeckyLoaderInstalling(true);
  await publishPluginHostState();
  try {
    const script = path.join(
      deckyCacheDirFor(os.homedir(), process.env.FLATPAK_ID),
      `decky-installer-${DECKY_INSTALLER.version}.sh`
    );
    try {
      await downloadVerified(DECKY_INSTALLER, script);
    } catch (error) {
      console.warn('[Decky] Installer download failed:', error);
      const mismatch =
        error instanceof MillenniumFetchError && error.kind === 'checksum-mismatch';
      return {
        success: false,
        reason: mismatch ? 'checksum-mismatch' : 'download-failed',
        error: errorText(error),
      };
    }

    console.log(`[Decky] Running Decky installer ${DECKY_INSTALLER.version}`);
    const run = await runOnHost(script);
    const decky = await waitForDecky();
    if (!decky?.running) {
      const tail = lastOutputLine(run.output);
      // The script copies the unit even when the loader download failed (GitHub rate limit), so only a live loader counts.
      console.warn(
        `[Decky] Installer exited (${run.code}) without a running Decky Loader${tail ? `: ${tail}` : ''}`
      );
      return {
        success: false,
        reason: decky?.installed ? 'not-running' : 'not-installed',
        error: tail ?? undefined,
      };
    }
    console.log('[Decky] Decky Loader installed and running');
    return { success: true };
  } finally {
    setDeckyLoaderInstalling(false);
    resetHostFacts();
    watchDeckyPlugins();
    syncBridgePluginSetup({ force: true });
    await publishPluginHostState();
  }
}

let running: Promise<DeckyLoaderInstallResult> | null = null;

// A second caller (the modal reopened mid-install) joins the run instead of starting another installer.
export function installDeckyLoader(): Promise<DeckyLoaderInstallResult> {
  if (!running) {
    running = runInstall().finally(() => {
      running = null;
    });
  }
  return running;
}
