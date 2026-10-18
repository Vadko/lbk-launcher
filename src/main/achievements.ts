import { hash } from 'node:crypto';
import { F } from '@mobily/ts-belt';
import pLimit from 'p-limit';
import { migrateLegacyAchievements } from '@/main/achievements/legacy';
import {
  type AchievementStrings,
  listStoredStrings,
  removeStringsOwnedBy,
} from '@/main/achievements/strings-store';
import { appEvents } from '@/main/app-events';
import { getAllInstalledGameIds } from '@/main/installer/cache';
import { getAchievementsBadge } from '@/main/plugin-host/state';
import { deliveryFromBadge } from '@/main/plugin-host/support';
import {
  invokeViaPlugin,
  isPluginConnected,
} from '@/main/steam-bridge-server/bridge-server';
import { writeBridgePluginData } from '@/main/utils/plugin-data';
import { isCefDebuggingEnabledInSettings } from '@/main/utils/store-storage';
import type { AchievementsDelivery } from '@/shared/plugin-host-types';

const RELOAD_TIMEOUT_MS = 10_000;

async function computeDelivery(reloaded: boolean): Promise<AchievementsDelivery> {
  try {
    return deliveryFromBadge(await getAchievementsBadge(), reloaded);
  } catch (error) {
    console.warn('[Achievements] Delivery check failed:', error);
    return isCefDebuggingEnabledInSettings() ? 'unavailable' : 'disabled';
  }
}

async function syncNow(): Promise<AchievementsDelivery> {
  try {
    const apps: Record<string, AchievementStrings> = {};
    for (const entry of listStoredStrings()) {
      apps[String(entry.appid)] = entry.strings;
    }
    const stamp = hash('sha1', JSON.stringify(apps)).slice(0, 16);
    writeBridgePluginData('achievements.json', { v: 1, stamp, apps });

    if (!isCefDebuggingEnabledInSettings() || !isPluginConnected()) {
      return computeDelivery(false);
    }
    try {
      const result = await invokeViaPlugin('achievementsReload', {}, RELOAD_TIMEOUT_MS);
      console.log(
        `[Achievements] Plugin reloaded ${result.apps} apps, coverage ${JSON.stringify(result.coverage)}`
      );
      return computeDelivery(true);
    } catch (error) {
      console.warn('[Achievements] Plugin reload failed:', error);
      return computeDelivery(false);
    }
  } catch (error) {
    console.warn('[Achievements] Sync to plugin failed:', error);
    return computeDelivery(false);
  }
}

const syncSerially = pLimit(1);

// Never rejects. Serialised so an install and a plugin reconnect cannot interleave writes.
export function syncAchievementsToPlugin(): Promise<AchievementsDelivery> {
  return syncSerially(syncNow);
}

// Startup only: no install is in flight yet, so strings without a record are orphans.
async function pruneOrphanStrings(): Promise<void> {
  const installed = new Set(await getAllInstalledGameIds());
  const orphans = new Set(
    listStoredStrings()
      .map((entry) => entry.gameId)
      .filter((gameId) => !installed.has(gameId))
  );
  removeStringsOwnedBy(orphans);
}

// Call from app startup, inside the single-instance branch.
export const startAchievements = F.once((): void => {
  appEvents.on('plugin-connection', (connected) => {
    if (connected) {
      void syncAchievementsToPlugin();
    }
  });
  appEvents.on('install-record-removed', (gameId) => {
    if (removeStringsOwnedBy(new Set([gameId]))) {
      void syncAchievementsToPlugin();
    }
  });
  void pruneOrphanStrings()
    .catch((error: unknown) =>
      console.warn('[Achievements] Orphan cleanup failed:', error)
    )
    .finally(() => void syncAchievementsToPlugin());
  void migrateLegacyAchievements()
    .then((changed) => (changed ? syncAchievementsToPlugin() : undefined))
    .catch((error: unknown) => {
      console.warn('[Achievements] Legacy migration failed:', error);
    });
});
