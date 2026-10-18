import * as fs from 'node:fs';
import * as path from 'node:path';
import { F } from '@mobily/ts-belt';
import { publishPluginHostState } from '@/main/millennium-install';
import { syncBridgePluginSetup } from '@/main/utils/cef-flag-file';
import { detectDeckyPluginSync, resetDeckyDetectCache } from '@/main/utils/decky';

let current: { root: string; controller: AbortController } | null = null;

// Decky installs, removes and toggles plugins without telling LBK; the badge must not wait out detectDecky()'s cache.
const pluginsChanged = F.debounce(() => {
  resetDeckyDetectCache();
  syncBridgePluginSetup();
  void publishPluginHostState();
}, 500);

export function stopDeckyWatcher(): void {
  current?.controller.abort();
  current = null;
}

// Idempotent; call again once Decky appears, since its homebrew dir may not exist at startup.
export function watchDeckyPlugins(): void {
  const homebrewDir = detectDeckyPluginSync()?.homebrewDir ?? null;
  if (homebrewDir === (current?.root ?? null)) {
    return;
  }
  stopDeckyWatcher();
  if (!homebrewDir) {
    return;
  }
  const controller = new AbortController();
  current = { root: homebrewDir, controller };
  // settings/loader.json holds the disabled-plugins list.
  for (const dir of [
    path.join(homebrewDir, 'plugins'),
    path.join(homebrewDir, 'settings'),
  ]) {
    try {
      fs.watch(dir, { signal: controller.signal }, () => pluginsChanged()).on(
        'error',
        (error) => {
          console.warn(`[Decky] Watcher for ${dir} failed:`, error);
        }
      );
    } catch (error) {
      console.warn(`[Decky] Cannot watch ${dir}:`, error);
    }
  }
}
