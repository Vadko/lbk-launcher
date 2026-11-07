import * as fs from 'node:fs';
import * as path from 'node:path';
import { F } from '@mobily/ts-belt';
import { syncBridgePluginSetup } from '@/main/plugin-host/bridge-plugin-setup';
import { publishPluginHostState } from '@/main/plugin-host/state';
import { detectDeckyPluginSync, resetDeckyDetectCache } from '@/main/utils/decky';

interface Watching {
  root: string;
  controller: AbortController;
  // Dirs whose watch failed or died; settings/ appears only once the loader first writes it.
  unwatched: Set<string>;
}

let current: Watching | null = null;

// Decky installs, removes and toggles plugins without telling LBK; the badge must not wait out detectDecky()'s cache.
const pluginsChanged = F.debounce(() => {
  resetDeckyDetectCache();
  void syncBridgePluginSetup();
  void publishPluginHostState();
}, 500);

export function stopDeckyWatcher(): void {
  current?.controller.abort();
  current = null;
}

function watchDir(dir: string, watching: Watching): void {
  try {
    fs.watch(dir, { signal: watching.controller.signal }, () => pluginsChanged()).on(
      'error',
      (error) => {
        console.warn(`[Decky] Watcher for ${dir} failed:`, error);
        watching.unwatched.add(dir);
      }
    );
    watching.unwatched.delete(dir);
  } catch (error) {
    console.warn(`[Decky] Cannot watch ${dir}:`, error);
    watching.unwatched.add(dir);
  }
}

// Idempotent; call again once Decky appears (its homebrew dir may not exist at startup), which also retries a failed watch.
export function watchDeckyPlugins(): void {
  const homebrewDir = detectDeckyPluginSync()?.homebrewDir ?? null;
  if (current && homebrewDir === current.root) {
    for (const dir of [...current.unwatched]) {
      watchDir(dir, current);
    }
    return;
  }
  stopDeckyWatcher();
  if (!homebrewDir) {
    return;
  }
  const watching: Watching = {
    root: homebrewDir,
    controller: new AbortController(),
    unwatched: new Set(),
  };
  current = watching;
  // settings/loader.json holds the disabled-plugins list.
  for (const dir of [
    path.join(homebrewDir, 'plugins'),
    path.join(homebrewDir, 'settings'),
  ]) {
    watchDir(dir, watching);
  }
}
