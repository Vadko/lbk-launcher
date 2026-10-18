import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { z } from 'zod';
import {
  type PluginManifest,
  readPluginManifest,
} from '@/main/plugin-host/plugin-manifest';
import { compareVersions } from '@/shared/version';
import { readTextOrNull } from './fs-safe';
import { readJsonFile } from './json-file';
import { isLinux } from './platform';

// plugin.json "name"; Decky addresses the plugin by it and its install prompt must pass the same value.
const DECKY_PLUGIN_NAME = 'LBK Bridge';
// Top directory of the zip, so the folder Decky creates under plugins/ and data/.
export const DECKY_PLUGIN_DIR = 'lbk-bridge';

export interface DeckyInfo {
  installed: boolean;
  homebrewDir: string;
  running: boolean;
  plugin: {
    installed: boolean;
    dir: string | null;
    version: string | null;
    disabled: boolean;
  };
}

const SYSTEM_UNIT = '/etc/systemd/system/plugin_loader.service';
const LOADER_URL = 'http://127.0.0.1:1337/';
const PROBE_TIMEOUT_MS = 1000;
const DETECT_CACHE_MS = 30_000;

export function parseUnprivilegedPath(unit: string): string | null {
  const match = /^\s*Environment\s*=\s*"?UNPRIVILEGED_PATH=([^"\r\n]+)"?\s*$/m.exec(unit);
  return match ? match[1].trim() : null;
}

export function findPluginDir(
  entries: readonly { dir: string; pluginJson: PluginManifest | null }[]
): string | null {
  const found = entries.find((entry) => entry.pluginJson?.name === DECKY_PLUGIN_NAME);
  return found?.dir ?? null;
}

const loaderSettingsSchema = z.object({ disabled_plugins: z.array(z.unknown()) });

export function isPluginDisabled(
  loaderJson: z.infer<typeof loaderSettingsSchema> | null
): boolean {
  return loaderJson?.disabled_plugins.includes(DECKY_PLUGIN_NAME) ?? false;
}

// Must stay inside what the deckyRequestInstall op accepts: Decky opens it as root.
export function deckyCacheDirFor(home: string, flatpakId: string | undefined): string {
  const cache = flatpakId
    ? path.posix.join(home, '.var', 'app', flatpakId, 'cache')
    : path.posix.join(home, '.cache');
  return path.posix.join(cache, 'lbk-launcher', 'decky');
}

export function deckyArtifactUrl(cacheDir: string, version: string): string {
  // Decky strips "file://" and opens the rest verbatim, so the path is not URL-encoded.
  return `file://${path.posix.join(cacheDir, `lbk-bridge-${version}.zip`)}`;
}

// Decky's PluginInstallType: 0 install, 1 reinstall, 2 update.
export function deckyInstallType(
  plugin: { installed: boolean; version: string | null },
  current: string
): 0 | 1 | 2 {
  if (!plugin.installed) {
    return 0;
  }
  return plugin.version === null || compareVersions(plugin.version, current) < 0 ? 2 : 1;
}

function homebrewDirFor(home: string): string {
  const unit = readTextOrNull(SYSTEM_UNIT);
  return (unit && parseUnprivilegedPath(unit)) || path.join(home, 'homebrew');
}

// Sync and cheap: only file checks, for callers that must not await.
export function isDeckyInstalledSync(): boolean {
  if (!isLinux()) {
    return false;
  }
  const home = os.homedir();
  return (
    fs.existsSync(SYSTEM_UNIT) ||
    fs.existsSync(path.join(homebrewDirFor(home), 'services', 'PluginLoader'))
  );
}

function probeLoader(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(LOADER_URL, { timeout: PROBE_TIMEOUT_MS }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

function findInstalledPlugin(homebrewDir: string): DeckyInfo['plugin'] {
  const pluginsDir = path.join(homebrewDir, 'plugins');
  let names: string[] = [];
  try {
    names = fs.readdirSync(pluginsDir);
  } catch {
    // Decky not set up yet or the dir is unreadable.
  }
  const dir = findPluginDir(
    names.map((name) => ({
      dir: path.join(pluginsDir, name),
      pluginJson: readPluginManifest(path.join(pluginsDir, name, 'plugin.json')),
    }))
  );
  if (!dir) {
    return { installed: false, dir: null, version: null, disabled: false };
  }
  return {
    installed: true,
    dir,
    version: readPluginManifest(path.join(dir, 'package.json'))?.version ?? null,
    disabled: isPluginDisabled(
      readJsonFile(
        path.join(homebrewDir, 'settings', 'loader.json'),
        loaderSettingsSchema
      )
    ),
  };
}

// File checks only, no loopback probe, so writers can call it synchronously.
export function detectDeckyPluginSync(): Omit<DeckyInfo, 'installed' | 'running'> | null {
  if (!isDeckyInstalledSync()) {
    return null;
  }
  const homebrewDir = homebrewDirFor(os.homedir());
  return { homebrewDir, plugin: findInstalledPlugin(homebrewDir) };
}

let cache: { at: number; value: DeckyInfo | null } | null = null;

export function resetDeckyDetectCache(): void {
  cache = null;
}

export async function detectDecky(): Promise<DeckyInfo | null> {
  if (!isLinux()) {
    return null;
  }
  const now = Date.now();
  if (cache && now - cache.at < DETECT_CACHE_MS && now >= cache.at) {
    return cache.value;
  }
  const found = detectDeckyPluginSync();
  const value: DeckyInfo | null = found
    ? { installed: true, running: await probeLoader(), ...found }
    : null;
  cache = { at: now, value };
  return value;
}
