import { spawn } from 'node:child_process';
import { once } from 'node:events';
import * as os from 'node:os';
import * as path from 'node:path';
import pMemoize from 'p-memoize';
import pWaitFor from 'p-wait-for';
import { getCleanEnv } from '@/main/installer/archive';
import { publishPluginHostState } from '@/main/millennium-install';
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
import { isFlatpak } from '@/main/utils/host-exec';
import { downloadPinned, PinnedDownloadError } from '@/main/utils/pinned-download';
import { errorMessage } from '@/shared/errors';
import type { DeckyLoaderInstallResult } from '@/shared/plugin-host-types';

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

function lastOutputLine(output: string): string | null {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1].slice(0, 300) : null;
}

async function runOnHost(
  script: string
): Promise<{ code: number | null; output: string }> {
  const child = isFlatpak()
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
  // A late error, after LBK stopped waiting, must not become an uncaught exception.
  child.on('error', () => undefined);
  try {
    const [code] = await once(child, 'close', {
      signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
    });
    return { code: typeof code === 'number' ? code : null, output };
  } catch (error) {
    // A spawn error rejects with that error; the timeout rejects with an AbortError and leaves the child running.
    const spawnError =
      error instanceof Error && error.name !== 'AbortError' ? `\n${error.message}` : '';
    return { code: null, output: `${output}${spawnError}` };
  }
}

// The script's exit code says nothing: it re-runs itself under sudo and always exits 1 afterwards.
function waitForDecky(): Promise<DeckyInfo | null> {
  let decky: DeckyInfo | null = null;
  return pWaitFor<DeckyInfo | null>(
    async () => {
      resetDeckyDetectCache();
      decky = await detectDecky().catch(() => null);
      return decky?.running ? pWaitFor.resolveWith(decky) : false;
    },
    {
      interval: POLL_MS,
      timeout: {
        milliseconds: SETTLE_MS,
        fallback: () => (decky?.installed ? decky : null),
      },
    }
  );
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
      await downloadPinned(DECKY_INSTALLER, script);
    } catch (error) {
      console.warn('[Decky] Installer download failed:', error);
      const mismatch =
        error instanceof PinnedDownloadError && error.kind === 'checksum-mismatch';
      return {
        success: false,
        reason: mismatch ? 'checksum-mismatch' : 'download-failed',
        error: errorMessage(error),
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
    syncBridgePluginSetup();
    await publishPluginHostState();
  }
}

// A second caller (the modal reopened mid-install) joins the run instead of starting another installer.
export const installDeckyLoader = pMemoize(runInstall, {
  cache: false,
  cacheKey: () => 'install',
});
