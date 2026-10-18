import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { G } from '@mobily/ts-belt';
import { LRUCache } from 'lru-cache';
import { getSteamPath } from '@/main/game-detector/steam';
import { isFlatpak } from './host-exec';
import { getPlatform } from './platform';

export type MillenniumGeneration = 'v2' | 'v3';

type MillenniumOS = 'windows' | 'linux' | 'macos';

export interface MillenniumInfo {
  installed: boolean;
  generation: MillenniumGeneration | null;
  blocksTcpCdp: boolean;
  pluginsDir: string | null;
  configPath: string | null;
  evidence: string[];
}

const DETECT_CACHE_MS = 60_000;

const WIN_V3_LIB = 'millennium/lib/millennium.dll';
const WIN_V3_LOADER = 'wsock32.dll';
const WIN_V2_LIB = 'millennium.dll';
const WIN_V2_SHIM = 'user32.dll.local';
const LINUX_RUNTIME = '/usr/lib/millennium/libmillennium_x86.so';
const LINUX_XTST_LINK = 'ubuntu12_32/libXtst.so.6';
const MAC_APP_GLOBAL = '/Applications/Steam Millennium.app';
const MAC_APP_USER = '~/Applications/Steam Millennium.app';
const MAC_RUNTIME = '~/Library/Application Support/Millennium/runtime';
const MAC_TIER0 = 'Steam.AppBundle/Steam/Contents/MacOS/libtier0_s.real.dylib';
const FLATPAK_STEAM_ID = 'com.valvesoftware.Steam';

const MARKERS: Record<MillenniumOS, readonly string[]> = {
  windows: [WIN_V3_LIB, WIN_V3_LOADER, WIN_V2_LIB, WIN_V2_SHIM],
  linux: [LINUX_RUNTIME],
  macos: [MAC_APP_GLOBAL, MAC_APP_USER, MAC_RUNTIME, MAC_TIER0],
};

export function classifyMillenniumMarkers(
  os: MillenniumOS,
  present: ReadonlySet<string>,
  xtstLinkTarget: string | null
): { generation: MillenniumGeneration | null; evidence: string[] } {
  const evidence = MARKERS[os].filter((marker) => present.has(marker));
  let generation: MillenniumGeneration | null = null;

  if (os === 'windows') {
    // wsock32.dll is the v3 loader; without it the DLLs under millennium/ are inert.
    if (present.has(WIN_V3_LIB) && present.has(WIN_V3_LOADER)) {
      generation = 'v3';
    } else if (present.has(WIN_V2_LIB) && present.has(WIN_V2_SHIM)) {
      generation = 'v2';
    }
  } else if (os === 'linux') {
    if (xtstLinkTarget !== null) {
      evidence.push(`libXtst.so.6 -> ${xtstLinkTarget}`);
      if (xtstLinkTarget.toLowerCase().includes('millennium')) {
        generation = 'v3';
      }
    }
  } else if (evidence.length > 0) {
    generation = 'v3';
  }

  return { generation, evidence: evidence.sort() };
}

export function resolveMillenniumPaths(i: {
  os: MillenniumOS;
  steamPath: string;
  home: string;
  env: Record<string, string | undefined>;
  insideFlatpak: boolean;
}): { pluginsDirs: string[]; configPaths: string[] } {
  if (i.os === 'windows') {
    const root = path.win32.join(i.steamPath, 'millennium');
    return {
      pluginsDirs: [path.win32.join(root, 'plugins')],
      configPaths: [path.win32.join(root, 'config', 'config.json')],
    };
  }

  if (i.os === 'macos') {
    const root = path.posix.join(i.home, 'Library/Application Support/Millennium');
    return {
      pluginsDirs: [path.posix.join(root, 'plugins')],
      configPaths: [path.posix.join(root, 'config.json')],
    };
  }

  // Inside our Flatpak the XDG_* variables point at the sandbox, not at where host Steam looks.
  const dataHomes: string[] = [];
  const configHomes: string[] = [];
  if (!i.insideFlatpak && i.env.XDG_DATA_HOME) {
    dataHomes.push(i.env.XDG_DATA_HOME);
  }
  if (!i.insideFlatpak && i.env.XDG_CONFIG_HOME) {
    configHomes.push(i.env.XDG_CONFIG_HOME);
  }
  dataHomes.push(path.posix.join(i.home, '.local/share'));
  configHomes.push(path.posix.join(i.home, '.config'));
  const flatpakSteam = path.posix.join(i.home, '.var/app', FLATPAK_STEAM_ID);
  dataHomes.push(path.posix.join(flatpakSteam, 'data'));
  configHomes.push(path.posix.join(flatpakSteam, 'config'));

  return {
    pluginsDirs: dataHomes.map((dir) => path.posix.join(dir, 'millennium', 'plugins')),
    configPaths: configHomes.map((dir) =>
      path.posix.join(dir, 'millennium', 'config.json')
    ),
  };
}

type PlanResult =
  | { kind: 'unchanged' }
  | { kind: 'changed'; next: string }
  | { kind: 'invalid'; error: string };

export function planEnabledPluginsEdit(
  raw: string,
  name: string,
  enable: boolean
): PlanResult {
  let root: unknown;
  try {
    root = JSON.parse(raw);
  } catch (error) {
    return { kind: 'invalid', error: `config is not valid JSON: ${String(error)}` };
  }
  if (!G.isObject(root)) {
    return { kind: 'invalid', error: 'config root is not an object' };
  }
  // A fresh Millennium config has no `plugins` key until a plugin is first toggled; it reads a missing one as [].
  if (root.plugins === undefined) {
    root.plugins = {};
  }
  const plugins = root.plugins;
  if (!G.isObject(plugins)) {
    return { kind: 'invalid', error: '"plugins" is not an object' };
  }
  const current = plugins.enabledPlugins;
  if (current !== undefined && !Array.isArray(current)) {
    return { kind: 'invalid', error: '"plugins.enabledPlugins" is not an array' };
  }
  const list: unknown[] = current ?? [];
  const has = list.includes(name);

  if (enable === has) {
    return { kind: 'unchanged' };
  }
  plugins.enabledPlugins = enable
    ? [...list, name]
    : list.filter((entry) => entry !== name);

  // Millennium itself saves with a 2-space dump.
  return { kind: 'changed', next: `${JSON.stringify(root, null, 2)}\n` };
}

// Written before Millennium's first start; `checkForMillenniumUpdates` off where LBK manages updates.
export function renderInitialMillenniumConfig(
  pluginName: string,
  lbkManagesUpdates: boolean
): string {
  const config: Record<string, unknown> = { plugins: { enabledPlugins: [pluginName] } };
  if (lbkManagesUpdates) {
    config.general = { checkForMillenniumUpdates: false };
  }
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function readEnabledPlugins(configPath: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!G.isObject(parsed) || !G.isObject(parsed.plugins)) {
      return null;
    }
    const list = parsed.plugins.enabledPlugins;
    if (!Array.isArray(list)) {
      return null;
    }
    return list.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return null;
  }
}

function expandHome(marker: string, home: string): string {
  return marker.startsWith('~/') ? path.join(home, marker.slice(2)) : marker;
}

function readXtstLink(steamPath: string | null, home: string): string | null {
  const candidates = [
    ...(steamPath ? [path.join(steamPath, LINUX_XTST_LINK)] : []),
    path.join(home, '.steam/steam', LINUX_XTST_LINK),
  ];
  for (const candidate of candidates) {
    try {
      return fs.readlinkSync(candidate);
    } catch {
      // Missing or a regular file: vanilla Steam ships its own libXtst.
    }
  }
  return null;
}

function markerPath(
  os: MillenniumOS,
  marker: string,
  steamPath: string | null,
  home: string
): string | null {
  if (os === 'windows' || marker === MAC_TIER0) {
    return steamPath ? path.join(steamPath, marker) : null;
  }
  return expandHome(marker, home);
}

function pickPaths(candidates: { pluginsDirs: string[]; configPaths: string[] }): {
  pluginsDir: string | null;
  configPath: string | null;
} {
  for (let index = 0; index < candidates.pluginsDirs.length; index++) {
    const pluginsDir = candidates.pluginsDirs[index];
    // The `millennium` root exists once Millennium has run; `plugins` itself may not yet.
    if (fs.existsSync(path.dirname(pluginsDir))) {
      return { pluginsDir, configPath: candidates.configPaths[index] ?? null };
    }
  }
  return { pluginsDir: null, configPath: null };
}

function detectUncached(): MillenniumInfo {
  const platform = getPlatform();
  const none: MillenniumInfo = {
    installed: false,
    generation: null,
    blocksTcpCdp: false,
    pluginsDir: null,
    configPath: null,
    evidence: [],
  };
  if (platform === 'unknown') {
    return none;
  }

  const steamPath = getSteamPath();
  const home = os.homedir();
  const present = new Set<string>();
  for (const marker of MARKERS[platform]) {
    const filePath = markerPath(platform, marker, steamPath, home);
    if (filePath && fs.existsSync(filePath)) {
      present.add(marker);
    }
  }
  const xtst = platform === 'linux' ? readXtstLink(steamPath, home) : null;
  const { generation, evidence } = classifyMillenniumMarkers(platform, present, xtst);

  if (generation === null) {
    return { ...none, evidence };
  }

  const paths =
    generation === 'v3' && (steamPath || platform !== 'windows')
      ? pickPaths(
          resolveMillenniumPaths({
            os: platform,
            steamPath: steamPath ?? '',
            home,
            env: process.env,
            insideFlatpak: isFlatpak(),
          })
        )
      : { pluginsDir: null, configPath: null };

  return {
    installed: true,
    generation,
    // Whether Millennium deletes the flag file: Windows/Linux do; the macOS fork runs CDP on a pipe but leaves the file.
    blocksTcpCdp: platform !== 'macos',
    pluginsDir: paths.pluginsDir,
    configPath: paths.configPath,
    evidence,
  };
}

// Steam started any other way (Dock, steam://) runs without Millennium on macOS.
export function findMacMillenniumWrapper(): string | null {
  const home = os.homedir();
  for (const marker of [MAC_APP_GLOBAL, MAC_APP_USER]) {
    const app = expandHome(marker, home);
    if (fs.existsSync(path.join(app, 'Contents/MacOS/steam_osx'))) {
      return app;
    }
  }
  return null;
}

// Expired entries stay readable through peek(), so a re-detection logs only when the result changed.
const detected: LRUCache<'millennium', MillenniumInfo> = new LRUCache({
  max: 1,
  ttl: DETECT_CACHE_MS,
  noDeleteOnStaleGet: true,
  memoMethod: () => {
    const previous = detected.peek('millennium', { allowStale: true });
    const value = detectUncached();
    if (
      previous?.generation !== value.generation ||
      previous.pluginsDir !== value.pluginsDir
    ) {
      console.log('[Millennium] Detection:', JSON.stringify(value));
    }
    return value;
  },
});

export function resetMillenniumDetectCache(): void {
  detected.clear();
}

export function detectMillennium(): MillenniumInfo {
  return detected.memo('millennium');
}
