import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { G } from '@mobily/ts-belt';
import { dirSwapPath, replaceDirAtomic } from './atomic-write';
import { readFileOrNull, readTextOrNull } from './fs-safe';
import { isFlatpak, system32 } from './host-exec';
import {
  detectMillennium,
  planEnabledPluginsEdit,
  readEnabledPlugins,
} from './millennium';
import { isLinux, isMacOS, isWindows } from './platform';
import { isCrashpadHandler, MAC_MILLENNIUM_LAUNCHER_RE } from './steam-process-match';
import { resolveResource } from './theme';

export const MILLENNIUM_PLUGIN_NAME = 'lbk-bridge';

type PluginDataFile = 'bridge.json' | 'achievements.json';

const DATA_FILES: readonly PluginDataFile[] = ['bridge.json', 'achievements.json'];
const PLUGIN_JSON = 'plugin.json';
const FRONTEND_SUBDIR = path.join('.millennium', 'Dist');
const FRONTEND_ENTRY = 'index.js';

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
  return path.join(info.pluginsDir, MILLENNIUM_PLUGIN_NAME);
}

function getBundledPluginDir(): string {
  return path.join(resolveResource('millennium-plugin'), MILLENNIUM_PLUGIN_NAME);
}

function readVersion(pluginJsonPath: string): string | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
    if (typeof parsed === 'object' && parsed !== null && 'version' in parsed) {
      const version = (parsed as { version: unknown }).version;
      return typeof version === 'string' ? version : null;
    }
    return null;
  } catch {
    return null;
  }
}

function isOurPluginDir(dir: string): boolean {
  try {
    const parsed: unknown = JSON.parse(
      fs.readFileSync(path.join(dir, PLUGIN_JSON), 'utf8')
    );
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { name?: unknown }).name === MILLENNIUM_PLUGIN_NAME
    );
  } catch {
    return false;
  }
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
    supported && info.pluginsDir
      ? path.join(info.pluginsDir, MILLENNIUM_PLUGIN_NAME)
      : null;
  const installed =
    dir !== null &&
    fs.existsSync(path.join(dir, FRONTEND_SUBDIR, FRONTEND_ENTRY)) &&
    isOurPluginDir(dir);
  const enabledList = info.configPath ? readEnabledPlugins(info.configPath) : null;

  return {
    supported,
    installed,
    installedVersion: installed && dir ? readVersion(path.join(dir, PLUGIN_JSON)) : null,
    enabled: Boolean(enabledList?.includes(MILLENNIUM_PLUGIN_NAME)),
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

function writePluginTree(
  target: string,
  bundledPluginJson: Buffer,
  bundledIndex: Buffer,
  data: Map<PluginDataFile, string | Buffer>
): void {
  const frontendDir = path.join(target, FRONTEND_SUBDIR);
  fs.mkdirSync(frontendDir, { recursive: true });
  fs.writeFileSync(path.join(frontendDir, FRONTEND_ENTRY), bundledIndex);
  for (const [file, content] of data) {
    fs.writeFileSync(path.join(frontendDir, file), content, { mode: dataFileMode() });
  }
  // Written last: Millennium treats any folder with a plugin.json as a plugin.
  fs.writeFileSync(path.join(target, PLUGIN_JSON), bundledPluginJson);
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
  const dir = path.join(pluginsDir, MILLENNIUM_PLUGIN_NAME);
  const bundledDir = getBundledPluginDir();
  const bundledPluginJson = readFileOrNull(path.join(bundledDir, PLUGIN_JSON));
  const bundledIndex = readFileOrNull(path.join(bundledDir, 'frontend', FRONTEND_ENTRY));
  if (!bundledPluginJson || !bundledIndex) {
    return { ok: false, error: `bundled plugin not found at ${bundledDir}` };
  }

  try {
    // A crash mid-swap leaves a second copy of our plugin.json in the dir Millennium scans.
    fs.rmSync(dirSwapPath(dir), { recursive: true, force: true });
  } catch (error) {
    console.warn('[Millennium] Stale plugin copy not removed:', error);
  }

  const installedPluginJson = readFileOrNull(path.join(dir, PLUGIN_JSON));
  const installedIndex = readFileOrNull(path.join(dir, FRONTEND_SUBDIR, FRONTEND_ENTRY));
  if (
    installedPluginJson &&
    installedIndex &&
    installedPluginJson.equals(bundledPluginJson) &&
    installedIndex.equals(bundledIndex)
  ) {
    return { ok: true, changed: false };
  }

  if (fs.existsSync(dir) && !isOurPluginDir(dir)) {
    return { ok: false, error: `${dir} belongs to another plugin` };
  }

  try {
    const data = collectDataFiles(dir);
    const write = (target: string) =>
      writePluginTree(target, bundledPluginJson, bundledIndex, data);
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

  console.log(`[Millennium] Plugin ${MILLENNIUM_PLUGIN_NAME} installed to ${dir}`);
  return { ok: true, changed: true };
}

function steamRunningOutput(command: string, args: string[]): string | null {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (error) {
    // pgrep exits 1 when nothing matches.
    if (G.isObject(error) && error.status === 1) {
      return '';
    }
    return null;
  }
}

// Null when the process exited mid-scan.
function readProcFile(pid: string, file: string): string | null {
  return readTextOrNull(path.join('/proc', pid, file));
}

// Same rule as waitForSteamGone: a lingering crashpad handler is not a running Steam.
function scanProcForSteam(): boolean | null {
  let entries: string[];
  try {
    entries = fs.readdirSync('/proc');
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) {
      continue;
    }
    const comm = readProcFile(entry, 'comm')?.trim();
    if (comm === 'steam') {
      return true;
    }
    if (comm === 'steamwebhelper' && !isCrashpadHandler(readProcFile(entry, 'cmdline'))) {
      return true;
    }
  }
  return false;
}

function anyLiveSteamLine(pgrepFullOutput: string): boolean {
  return pgrepFullOutput
    .split('\n')
    .map((line) => line.trim())
    .some((line) => line.length > 0 && !isCrashpadHandler(line));
}

function macSteamRunningSync(): boolean | null {
  const out = steamRunningOutput('pgrep', ['-x', 'steam_osx']);
  if (out === null) {
    return null;
  }
  const pids = out.split(/\s+/).filter((s) => /^\d+$/.test(s));
  if (pids.length === 0) {
    return false;
  }
  const ps = steamRunningOutput('ps', ['-o', 'pid=,comm=', '-p', pids.join(',')]);
  if (!ps) {
    return true;
  }
  const comms = ps.split('\n').flatMap((line) => /^\s*\d+\s+(.+)$/.exec(line)?.[1] ?? []);
  return (
    comms.length === 0 || comms.some((comm) => !MAC_MILLENNIUM_LAUNCHER_RE.test(comm))
  );
}

// Synchronous so the config check and rename stay back to back; null means unknown.
export function isSteamRunningSync(): boolean | null {
  if (isWindows()) {
    const out = steamRunningOutput(system32('tasklist.exe'), [
      '/FI',
      'IMAGENAME eq steam*',
      '/NH',
      '/FO',
      'CSV',
    ]);
    return out === null ? null : /"steam(webhelper)?\.exe"/i.test(out);
  }
  if (isLinux()) {
    if (isFlatpak()) {
      const out = steamRunningOutput('flatpak-spawn', [
        '--host',
        'pgrep',
        '-a',
        '-x',
        'steam|steamwebhelper',
      ]);
      return out === null ? null : anyLiveSteamLine(out);
    }
    return scanProcForSteam();
  }
  if (isMacOS()) {
    return macSteamRunningSync();
  }
  return null;
}

export function setMillenniumPluginEnabledInConfig(
  enable: boolean
): 'changed' | 'unchanged' | 'steam-running' | 'invalid-config' | 'no-config' {
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

  const plan = planEnabledPluginsEdit(raw, MILLENNIUM_PLUGIN_NAME, enable);
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
    if (isSteamRunningSync() !== false) {
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
    `[Millennium] ${enable ? 'Enabled' : 'Disabled'} ${MILLENNIUM_PLUGIN_NAME} in ${configPath}`
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
