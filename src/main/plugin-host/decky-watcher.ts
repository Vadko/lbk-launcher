import * as fs from 'node:fs';
import * as path from 'node:path';
import { F } from '@mobily/ts-belt';
import { publishPluginHostState } from '@/main/millennium-install';
import { syncBridgePluginSetup } from '@/main/utils/cef-flag-file';
import { detectDeckyPluginSync, resetDeckyDetectCache } from '@/main/utils/decky';

let watchers: fs.FSWatcher[] = [];
let watchedRoot: string | null = null;

// Decky installs, removes and toggles plugins without telling LBK; the badge must not wait out detectDecky()'s cache.
const pluginsChanged = F.debounce(() => {
  resetDeckyDetectCache();
  syncBridgePluginSetup();
  void publishPluginHostState();
}, 500);

export function stopDeckyWatcher(): void {
  for (const watcher of watchers) {
    watcher.close();
  }
  watchers = [];
  watchedRoot = null;
}

// Idempotent; call again once Decky appears, since its homebrew dir may not exist at startup.
export function watchDeckyPlugins(): void {
  const homebrewDir = detectDeckyPluginSync()?.homebrewDir ?? null;
  if (homebrewDir === watchedRoot) {
    return;
  }
  stopDeckyWatcher();
  if (!homebrewDir) {
    return;
  }
  watchedRoot = homebrewDir;
  // settings/loader.json holds the disabled-plugins list.
  for (const dir of [
    path.join(homebrewDir, 'plugins'),
    path.join(homebrewDir, 'settings'),
  ]) {
    try {
      const watcher = fs.watch(dir, () => pluginsChanged());
      watcher.on('error', (error) => {
        console.warn(`[Decky] Watcher for ${dir} failed:`, error);
      });
      watchers.push(watcher);
    } catch (error) {
      console.warn(`[Decky] Cannot watch ${dir}:`, error);
    }
  }
}
