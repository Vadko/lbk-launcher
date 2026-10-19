import * as fs from 'node:fs';
import * as path from 'node:path';
import { BRIDGE_PLUGIN_NAME } from '@lbk/bridge-core/contract';
import pLimit from 'p-limit';
import { bundledBridgeFiles } from '@/main/plugin-host/bundled-bridge';
import { readPluginManifest } from '@/main/plugin-host/plugin-manifest';
import { isSteamStopped } from '@/main/steam-process/lifecycle';
import { dirSwapPath, replaceDirAtomic } from './atomic-write';
import { readFileOrNull } from './fs-safe';
import {
  detectMillennium,
  planEnabledPluginsEdit,
  readEnabledPlugins,
} from './millennium';
import { isWindows } from './platform';

type PluginDataFile = 'bridge.json' | 'achievements.json';

const DATA_FILES: readonly PluginDataFile[] = ['bridge.json', 'achievements.json'];
const PLUGIN_JSON = 'plugin.json';
const FRONTEND_SUBDIR = path.join('.millennium', 'Dist');
const FRONTEND_ENTRY = 'index.js';
// Millennium injects it into Steam's web pages at Steam start; it reads achievements.json from the same folder.
const WEBKIT_ENTRY = 'webkit.js';

// Every edit goes through one temp file and plans from what it reads, so two must not overlap.
const configEdits = pLimit(1);

export interface MillenniumPluginState {
  supported: boolean;
  installed: boolean;
  installedVersion: string | null;
  enabled: boolean;
  dir: string | null;
}

function getPluginDir(): string | null {
  const info = detectMillennium();
  if (info.generation !== 'v3' || !info.pluginsDir) {
    return null;
  }
  return path.join(info.pluginsDir, BRIDGE_PLUGIN_NAME);
}

function isOurPluginDir(dir: string): boolean {
  return readPluginManifest(path.join(dir, PLUGIN_JSON))?.name === BRIDGE_PLUGIN_NAME;
}

function dataFileMode(): number | undefined {
  return isWindows() ? undefined : 0o600;
}

export function getMillenniumPluginState(): MillenniumPluginState {
  const info = detectMillennium();
  const supported =
    info.generation === 'v3' &&
    info.pluginsDir !== null &&
    fs.existsSync(path.dirname(info.pluginsDir));
  const dir =
    supported && info.pluginsDir ? path.join(info.pluginsDir, BRIDGE_PLUGIN_NAME) : null;
  const installed =
    dir !== null &&
    fs.existsSync(path.join(dir, FRONTEND_SUBDIR, FRONTEND_ENTRY)) &&
    isOurPluginDir(dir);
  const enabledList = info.configPath ? readEnabledPlugins(info.configPath) : null;

  return {
    supported,
    installed,
    installedVersion:
      installed && dir
        ? (readPluginManifest(path.join(dir, PLUGIN_JSON))?.version ?? null)
        : null,
    enabled: Boolean(enabledList?.includes(BRIDGE_PLUGIN_NAME)),
    dir,
  };
}

// Carried over an update; plugin-data.ts then rewrites whatever this session produced.
function collectDataFiles(dir: string): Map<PluginDataFile, string | Buffer> {
  const out = new Map<PluginDataFile, string | Buffer>();
  for (const file of DATA_FILES) {
    const existing = readFileOrNull(path.join(dir, FRONTEND_SUBDIR, file));
    if (existing) {
      out.set(file, existing);
    }
  }
  return out;
}

interface PluginBundle {
  pluginJson: Buffer;
  index: Buffer;
  webkit: Buffer;
}

function readBundledPlugin(
  files: ReturnType<typeof bundledBridgeFiles>
): PluginBundle | null {
  const pluginJson = readFileOrNull(files.pluginJson);
  const index = readFileOrNull(files.index);
  const webkit = files.webkit ? readFileOrNull(files.webkit) : null;
  return pluginJson && index && webkit ? { pluginJson, index, webkit } : null;
}

const distFiles = (bundle: PluginBundle): [string, Buffer][] => [
  [FRONTEND_ENTRY, bundle.index],
  [WEBKIT_ENTRY, bundle.webkit],
];

function isUpToDate(dir: string, bundle: PluginBundle): boolean {
  const same = (file: string, content: Buffer) =>
    readFileOrNull(file)?.equals(content) === true;
  return (
    same(path.join(dir, PLUGIN_JSON), bundle.pluginJson) &&
    distFiles(bundle).every(([name, content]) =>
      same(path.join(dir, FRONTEND_SUBDIR, name), content)
    )
  );
}

function writePluginTree(
  target: string,
  bundle: PluginBundle,
  data: Map<PluginDataFile, string | Buffer>
): void {
  const frontendDir = path.join(target, FRONTEND_SUBDIR);
  fs.mkdirSync(frontendDir, { recursive: true });
  for (const [name, content] of distFiles(bundle)) {
    fs.writeFileSync(path.join(frontendDir, name), content);
  }
  for (const [file, content] of data) {
    fs.writeFileSync(path.join(frontendDir, file), content, { mode: dataFileMode() });
  }
  // Written last: Millennium treats any folder with a plugin.json as a plugin.
  fs.writeFileSync(path.join(target, PLUGIN_JSON), bundle.pluginJson);
}

export function installOrUpdateMillenniumPlugin():
  | { ok: true; changed: boolean }
  | { ok: false; error: string } {
  const info = detectMillennium();
  if (info.generation !== 'v3') {
    return { ok: false, error: 'millennium-v3-not-detected' };
  }
  if (!info.pluginsDir || !fs.existsSync(path.dirname(info.pluginsDir))) {
    return { ok: false, error: 'millennium-plugins-dir-not-found' };
  }

  const pluginsDir = info.pluginsDir;
  const dir = path.join(pluginsDir, BRIDGE_PLUGIN_NAME);
  const files = bundledBridgeFiles('millennium');
  const bundle = readBundledPlugin(files);
  if (!bundle) {
    return {
      ok: false,
      error: `bundled plugin not found at ${path.dirname(files.pluginJson)}`,
    };
  }

  try {
    // A crash mid-swap leaves a second copy of our plugin.json in the dir Millennium scans.
    fs.rmSync(dirSwapPath(dir), { recursive: true, force: true });
  } catch (error) {
    console.warn('[Millennium] Stale plugin copy not removed:', error);
  }

  if (isUpToDate(dir, bundle)) {
    return { ok: true, changed: false };
  }

  if (fs.existsSync(dir) && !isOurPluginDir(dir)) {
    return { ok: false, error: `${dir} belongs to another plugin` };
  }

  try {
    const data = collectDataFiles(dir);
    const write = (target: string) => writePluginTree(target, bundle, data);
    try {
      // Also creates `plugins`, which Millennium makes lazily; the parent existing proves it ran.
      replaceDirAtomic(dir, write);
    } catch (error) {
      // Windows: a file Steam holds open blocks the swap, so overwrite in place instead.
      console.warn('[Millennium] Plugin swap failed, overwriting in place:', error);
      write(dir);
    }
  } catch (error) {
    console.warn('[Millennium] Plugin install failed:', error);
    return { ok: false, error: String(error) };
  }

  console.log(`[Millennium] Plugin ${BRIDGE_PLUGIN_NAME} installed to ${dir}`);
  return { ok: true, changed: true };
}

type ConfigEditResult =
  | 'changed'
  | 'unchanged'
  | 'steam-running'
  | 'invalid-config'
  | 'no-config';

export function setMillenniumPluginEnabledInConfig(
  enable: boolean
): Promise<ConfigEditResult> {
  return configEdits(() => editEnabledPlugins(enable));
}

async function editEnabledPlugins(enable: boolean): Promise<ConfigEditResult> {
  const { configPath } = detectMillennium();
  if (!configPath) {
    return 'no-config';
  }
  let raw: string;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch {
    return 'no-config';
  }

  const plan = planEnabledPluginsEdit(raw, BRIDGE_PLUGIN_NAME, enable);
  if (plan.kind === 'invalid') {
    console.warn(`[Millennium] Not editing ${configPath}: ${plan.error}`);
    return 'invalid-config';
  }
  if (plan.kind === 'unchanged') {
    return 'unchanged';
  }

  // Millennium holds config.json in memory and rewrites it on exit, so an edit under a running Steam is lost.
  const tmp = `${configPath}.lbk.tmp`;
  try {
    fs.writeFileSync(tmp, plan.next);
    // Awaited right before the rename, with nothing in between.
    if (!(await isSteamStopped())) {
      fs.rmSync(tmp, { force: true });
      return 'steam-running';
    }
    fs.renameSync(tmp, configPath);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    console.warn('[Millennium] Failed to update config.json:', error);
    return 'invalid-config';
  }

  console.log(
    `[Millennium] ${enable ? 'Enabled' : 'Disabled'} ${BRIDGE_PLUGIN_NAME} in ${configPath}`
  );
  return 'changed';
}

export function removeMillenniumPluginFiles(): void {
  const dir = getPluginDir();
  if (!dir || !fs.existsSync(dir)) {
    return;
  }
  if (!isOurPluginDir(dir)) {
    console.warn(`[Millennium] ${dir} is not ours, leaving it alone`);
    return;
  }
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`[Millennium] Removed plugin files at ${dir}`);
  } catch (error) {
    console.warn('[Millennium] Failed to remove plugin files:', error);
  }
}

// Where bridge.json and achievements.json go: next to the installed index.js.
export function millenniumPluginDataDir(): string | null {
  const dir = getPluginDir();
  if (!dir) {
    return null;
  }
  const frontendDir = path.join(dir, FRONTEND_SUBDIR);
  return fs.existsSync(path.join(frontendDir, FRONTEND_ENTRY)) ? frontendDir : null;
}
