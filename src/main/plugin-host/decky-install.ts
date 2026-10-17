import { hash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { app } from 'electron';
import { createZip } from '@/main/installer/archive';
import { publishPluginHostState } from '@/main/millennium-install';
import { syncBridgePluginSetup } from '@/main/utils/cef-flag-file';
import {
  DECKY_PLUGIN_DIR,
  deckyArtifactUrl,
  deckyCacheDirFor,
  deckyInstallType,
  detectDecky,
  resetDeckyDetectCache,
} from '@/main/utils/decky';
import { isLinux } from '@/main/utils/platform';
import { getSteamBridge } from '@/main/utils/steam-bridge';
import { MILLENNIUM_PLUGIN_VERSION } from '@/main/utils/steam-bridge-ops';
import {
  getConnectedPluginInfo,
  startSteamBridgeServer,
} from '@/main/utils/steam-bridge-server';
import { resolveResource } from '@/main/utils/theme';
import type { DeckyInstallResult } from '@/shared/types';

const POLL_MS = 2000;
const WATCH_MS = 5 * 60 * 1000;
const BUNDLED_FILES: readonly { from: string; to: string }[] = [
  { from: 'plugin.json', to: 'plugin.json' },
  { from: 'package.json', to: 'package.json' },
  { from: 'frontend/index.js', to: 'dist/index.js' },
];

interface DeckyZip {
  file: string;
  hash: string;
}

type SaveZipResult = { success: boolean; path?: string; error?: string };

function sha256(data: Buffer | string): string {
  return hash('sha256', data);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readBundled(): { to: string; data: Buffer }[] {
  const dir = path.join(resolveResource('decky-plugin'), DECKY_PLUGIN_DIR);
  const files = BUNDLED_FILES.map(({ from, to }) => ({
    to,
    data: fs.readFileSync(path.join(dir, from)),
  }));
  const pkg: unknown = JSON.parse(
    files.find((f) => f.to === 'package.json')?.data.toString('utf8') ?? 'null'
  );
  const version =
    typeof pkg === 'object' && pkg !== null
      ? (pkg as { version?: unknown }).version
      : null;
  if (version !== MILLENNIUM_PLUGIN_VERSION) {
    throw new Error(
      `bundled Decky plugin is ${String(version)}, expected ${MILLENNIUM_PLUGIN_VERSION}`
    );
  }
  return files;
}

function removeOtherZips(cacheDir: string, keep: string): void {
  for (const entry of fs.readdirSync(cacheDir)) {
    if (/^lbk-bridge-.*\.zip(\.source)?$/.test(entry) && entry !== keep) {
      fs.rmSync(path.join(cacheDir, entry), { force: true });
    }
  }
}

// Only a zip this process built is reused: the cache dir is user-writable, and Decky installs whatever matches the hash LBK hands it.
let lastBuilt: { digest: string; zip: DeckyZip } | null = null;

async function buildZip(): Promise<DeckyZip> {
  const files = readBundled();
  const digest = sha256(files.map((f) => `${f.to}\0${sha256(f.data)}`).join('\n'));
  const cacheDir = deckyCacheDirFor(os.homedir(), process.env.FLATPAK_ID);
  const name = `lbk-bridge-${MILLENNIUM_PLUGIN_VERSION}.zip`;
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
  removeOtherZips(cacheDir, name);
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
      plugin.version === MILLENNIUM_PLUGIN_VERSION &&
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
    connected.pluginVersion === MILLENNIUM_PLUGIN_VERSION
  ) {
    return { success: true, state: 'installed' };
  }

  let zip: DeckyZip;
  try {
    zip = await getDeckyZip();
  } catch (error) {
    console.warn('[Decky] Could not build the plugin zip:', error);
    return { success: false, reason: 'failed', error: errorText(error) };
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
  let answer: 'no-decky' | 'prompted';
  try {
    answer = await bridge.invoke('deckyRequestInstall', {
      artifact: deckyArtifactUrl(path.dirname(zip.file), MILLENNIUM_PLUGIN_VERSION),
      version: MILLENNIUM_PLUGIN_VERSION,
      hash: zip.hash,
      installType: deckyInstallType(decky.plugin, MILLENNIUM_PLUGIN_VERSION),
    });
  } catch (error) {
    console.warn('[Decky] Install request failed:', error);
    return { success: false, reason: 'failed', error: errorText(error) };
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
    return { success: false, error: errorText(error) };
  }
}
