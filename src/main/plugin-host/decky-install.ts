import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BRIDGE_VERSION } from '@lbk/bridge-core/contract';
import { app } from 'electron';
import { LRUCache } from 'lru-cache';
import pWaitFor from 'p-wait-for';
import { createZip } from '@/main/installer/archive';
import { bundledBridgeFiles } from '@/main/plugin-host/bundled-bridge';
import { watchDeckyPlugins } from '@/main/plugin-host/decky-watcher';
import {
  DECKY_PLUGIN_DIR,
  deckyArtifactUrl,
  deckyCacheDirFor,
  deckyInstallType,
  detectDecky,
  resetDeckyDetectCache,
} from '@/main/utils/decky';
import { pruneDir } from '@/main/utils/fs-safe';
import { sha256 } from '@/main/utils/hash';
import { isLinux } from '@/main/utils/platform';
import { getSteamBridge } from '@/main/utils/steam-bridge';
import {
  getConnectedPluginInfo,
  startSteamBridgeServer,
} from '@/main/utils/steam-bridge-server';
import { errorMessage } from '@/shared/errors';
import type { DeckyInstallResult } from '@/shared/plugin-host-types';

const POLL_MS = 2000;
const FRONTEND_WAIT_MS = 20_000;
// Decky loads dist/index.js as ESM only with "type": "module" and requires `version` once package.json exists.
const PACKAGE_JSON = `${JSON.stringify(
  {
    name: 'lbk-bridge',
    version: BRIDGE_VERSION,
    type: 'module',
    license: 'GPL-3.0-or-later',
  },
  null,
  2
)}\n`;

interface DeckyZip {
  file: string;
  hash: string;
}

interface ZipSources {
  cacheDir: string;
  name: string;
  files: { to: string; data: Buffer }[];
}

type SaveZipResult = { success: boolean; path?: string; error?: string };

function readBundled(): ZipSources['files'] {
  const bundled = bundledBridgeFiles('decky');
  return [
    { to: 'plugin.json', data: fs.readFileSync(bundled.pluginJson) },
    { to: 'package.json', data: Buffer.from(PACKAGE_JSON) },
    { to: 'dist/index.js', data: fs.readFileSync(bundled.index) },
  ];
}

async function buildZip({ cacheDir, name, files }: ZipSources): Promise<DeckyZip> {
  const file = path.join(cacheDir, name);
  const stageRoot = path.join(cacheDir, 'stage');
  const stage = path.join(stageRoot, DECKY_PLUGIN_DIR);
  const partial = path.join(cacheDir, 'partial.zip');
  fs.rmSync(stageRoot, { recursive: true, force: true });
  fs.rmSync(partial, { force: true });
  for (const f of files) {
    const target = path.join(stage, f.to);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, f.data);
  }
  try {
    await createZip(stage, partial);
    fs.renameSync(partial, file);
  } finally {
    fs.rmSync(stageRoot, { recursive: true, force: true });
    fs.rmSync(partial, { force: true });
  }
  pruneDir(
    cacheDir,
    (entry) => entry === name || !/^lbk-bridge-.*\.zip(\.source)?$/.test(entry)
  );
  console.log(`[Decky] Built ${file}`);
  return { file, hash: sha256(fs.readFileSync(file)) };
}

// Only a zip this process built is reused: the cache dir is user-writable, and Decky installs whatever matches the hash LBK hands it.
const builtZips = new LRUCache<string, DeckyZip, ZipSources>({
  max: 1,
  ignoreFetchAbort: true,
  fetchMethod: (_key, _stale, { context }) => buildZip(context),
});

// A rebuilt zip gets a new hash, which would fail an install prompt that is still open in Decky.
function getDeckyZip(): Promise<DeckyZip> {
  const sources: ZipSources = {
    cacheDir: deckyCacheDirFor(os.homedir(), process.env.FLATPAK_ID),
    name: `lbk-bridge-${BRIDGE_VERSION}.zip`,
    files: readBundled(),
  };
  const digest = sha256(
    sources.files.map((f) => `${f.to}\0${sha256(f.data)}`).join('\n')
  );
  const key = `${path.join(sources.cacheDir, sources.name)}|${digest}`;
  const built = builtZips.get(key);
  const intact =
    built !== undefined &&
    fs.existsSync(built.file) &&
    sha256(fs.readFileSync(built.file)) === built.hash;
  return builtZips.forceFetch(key, {
    context: sources,
    forceRefresh: built !== undefined && !intact,
  });
}

export async function requestDeckyPluginInstall(): Promise<DeckyInstallResult> {
  if (!isLinux()) {
    return { success: false, reason: 'no-decky' };
  }
  resetDeckyDetectCache();
  const decky = await detectDecky();
  if (!decky?.installed) {
    return { success: false, reason: 'no-decky' };
  }
  if (!decky.running) {
    return { success: false, reason: 'decky-not-running' };
  }
  const connected = getConnectedPluginInfo();
  if (
    decky.plugin.installed &&
    !decky.plugin.disabled &&
    connected?.host === 'decky' &&
    connected.pluginVersion === BRIDGE_VERSION
  ) {
    return { success: true, state: 'installed' };
  }

  let zip: DeckyZip;
  try {
    zip = await getDeckyZip();
  } catch (error) {
    console.warn('[Decky] Could not build the plugin zip:', error);
    return { success: false, reason: 'failed', error: errorMessage(error) };
  }
  const bridge = await getSteamBridge();
  if (!bridge) {
    return { success: false, reason: 'bridge-unavailable' };
  }
  // The new plugin dials in only once LBK serves bridge.json for it.
  startSteamBridgeServer().catch((error) => {
    console.warn('[SteamBridge] Plugin server failed to start:', error);
  });
  // install_plugin returns once the prompt is shown; the watcher picks up the plugin folder Decky creates.
  watchDeckyPlugins();

  const request = {
    artifact: deckyArtifactUrl(path.dirname(zip.file), BRIDGE_VERSION),
    version: BRIDGE_VERSION,
    hash: zip.hash,
    installType: deckyInstallType(decky.plugin, BRIDGE_VERSION),
  };
  let answer: 'no-decky' | 'prompted';
  try {
    // Decky injects its frontend ~10 s after its service starts, e.g. right after LBK installed it.
    answer = await pWaitFor<'no-decky' | 'prompted'>(
      async () => {
        const reply = await bridge.invoke('deckyRequestInstall', request);
        return reply === 'no-decky' ? false : pWaitFor.resolveWith(reply);
      },
      {
        interval: POLL_MS,
        timeout: { milliseconds: FRONTEND_WAIT_MS, fallback: () => 'no-decky' },
      }
    );
  } catch (error) {
    console.warn('[Decky] Install request failed:', error);
    return { success: false, reason: 'failed', error: errorMessage(error) };
  }
  if (answer !== 'prompted') {
    // Decky's frontend is not injected into Steam right now.
    return { success: false, reason: 'decky-not-running', error: answer };
  }
  return { success: true, state: 'prompted' };
}

export async function saveDeckyPluginZip(): Promise<SaveZipResult> {
  if (!isLinux()) {
    return { success: false, error: 'unsupported' };
  }
  try {
    const zip = await getDeckyZip();
    const dir = app.getPath('downloads');
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, path.basename(zip.file));
    fs.copyFileSync(zip.file, dest);
    return { success: true, path: dest };
  } catch (error) {
    console.warn('[Decky] Saving the plugin zip failed:', error);
    return { success: false, error: errorMessage(error) };
  }
}
