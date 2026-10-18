import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { BRIDGE_VERSION } from '@lbk/bridge-core/contract';
import { app } from 'electron';
import { createZip } from '@/main/installer/archive';
import { publishPluginHostState } from '@/main/millennium-install';
import { bundledBridgeFiles } from '@/main/plugin-host/bundled-bridge';
import { syncBridgePluginSetup } from '@/main/utils/cef-flag-file';
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
const WATCH_MS = 5 * 60 * 1000;
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

type SaveZipResult = { success: boolean; path?: string; error?: string };

function readBundled(): { to: string; data: Buffer }[] {
  const bundled = bundledBridgeFiles('decky');
  return [
    { to: 'plugin.json', data: fs.readFileSync(bundled.pluginJson) },
    { to: 'package.json', data: Buffer.from(PACKAGE_JSON) },
    { to: 'dist/index.js', data: fs.readFileSync(bundled.index) },
  ];
}

// Only a zip this process built is reused: the cache dir is user-writable, and Decky installs whatever matches the hash LBK hands it.
let lastBuilt: { digest: string; zip: DeckyZip } | null = null;

async function buildZip(): Promise<DeckyZip> {
  const files = readBundled();
  const digest = sha256(files.map((f) => `${f.to}\0${sha256(f.data)}`).join('\n'));
  const cacheDir = deckyCacheDirFor(os.homedir(), process.env.FLATPAK_ID);
  const name = `lbk-bridge-${BRIDGE_VERSION}.zip`;
  const file = path.join(cacheDir, name);
  // A rebuilt zip gets a new hash, which would fail an install prompt that is still open in Decky.
  if (
    lastBuilt?.digest === digest &&
    lastBuilt.zip.file === file &&
    fs.existsSync(file) &&
    sha256(fs.readFileSync(file)) === lastBuilt.zip.hash
  ) {
    return lastBuilt.zip;
  }

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
  const zip = { file, hash: sha256(fs.readFileSync(file)) };
  lastBuilt = { digest, zip };
  return zip;
}

let building: Promise<DeckyZip> | null = null;

function getDeckyZip(): Promise<DeckyZip> {
  if (!building) {
    building = buildZip().finally(() => {
      building = null;
    });
  }
  return building;
}

let watchTimer: NodeJS.Timeout | null = null;

function stopWatch(): void {
  if (watchTimer) {
    clearTimeout(watchTimer);
    watchTimer = null;
  }
}

function pluginFingerprint(plugin: {
  dir: string | null;
  version: string | null;
}): string {
  let ino = '';
  try {
    ino = plugin.dir ? String(fs.statSync(plugin.dir).ino) : '';
  } catch {
    ino = '';
  }
  return `${plugin.dir}|${ino}|${plugin.version}`;
}

// install_plugin returns once the prompt is shown, so success is the plugin folder appearing afterwards.
function watchForInstall(before: string | null): void {
  stopWatch();
  const startedAt = Date.now();
  const tick = async (): Promise<void> => {
    watchTimer = null;
    resetDeckyDetectCache();
    const decky = await detectDecky().catch(() => null);
    const plugin = decky?.plugin;
    const done =
      plugin?.installed === true &&
      plugin.version === BRIDGE_VERSION &&
      pluginFingerprint(plugin) !== before;
    if (done) {
      console.log(`[Decky] Plugin ${plugin.version} installed at ${plugin.dir}`);
      syncBridgePluginSetup({ force: true });
      await publishPluginHostState();
      return;
    }
    if (Date.now() - startedAt >= WATCH_MS) {
      console.warn('[Decky] No plugin install seen after the prompt');
      await publishPluginHostState();
      return;
    }
    watchTimer = setTimeout(() => void tick(), POLL_MS);
    watchTimer.unref();
  };
  watchTimer = setTimeout(() => void tick(), POLL_MS);
  watchTimer.unref();
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

  const before = pluginFingerprint(decky.plugin);
  const request = {
    artifact: deckyArtifactUrl(path.dirname(zip.file), BRIDGE_VERSION),
    version: BRIDGE_VERSION,
    hash: zip.hash,
    installType: deckyInstallType(decky.plugin, BRIDGE_VERSION),
  };
  // Decky injects its frontend ~10 s after its service starts, e.g. right after LBK installed it.
  const deadline = Date.now() + FRONTEND_WAIT_MS;
  let answer: 'no-decky' | 'prompted';
  try {
    answer = await bridge.invoke('deckyRequestInstall', request);
    while (answer === 'no-decky' && Date.now() < deadline) {
      await sleep(POLL_MS);
      answer = await bridge.invoke('deckyRequestInstall', request);
    }
  } catch (error) {
    console.warn('[Decky] Install request failed:', error);
    return { success: false, reason: 'failed', error: errorMessage(error) };
  }
  if (answer !== 'prompted') {
    // Decky's frontend is not injected into Steam right now.
    return { success: false, reason: 'decky-not-running', error: answer };
  }
  watchForInstall(before);
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
