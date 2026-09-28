/**
 * Subscribe/unsubscribe a translation in the Workshop via Steam's CEF bridge.
 *
 * The same path we already use to fix launch options and artwork:
 * `SteamClient.Apps.SubscribeWorkshopItem(appId, publishedFileId, subscribe)`
 * in the SharedJSContext context. The signature was checked against the
 * client's own bundle (`Subscribe(e,t){…(e,t,!0)}` / `Unsubscribe(e,t){…(e,t,!1)}`).
 *
 * The bridge is not always available: it needs the `.cef-enable-remote-debugging`
 * flag, a Steam restart, and no Millennium. So this is an optimization, not a
 * replacement — the renderer falls back to a plain steam:// deep link on failure.
 */

import {
  ensureCefBridge,
  evaluateInSharedJsContext,
  isCefUsable,
  jsLiteral,
} from '@/main/utils/steam-cef';
import type { SteamBridgeFailure } from '@/shared/types';

/** Mirrors the games row as-is — no point renaming these three fields along the way */
export interface WorkshopTarget {
  id: string;
  steam_app_id: number;
  workshop_id: string;
}

/**
 * Which of the translations are already on disk. One round trip to Steam for
 * the whole list: a separate CDP session per translation would cost seconds
 * with dozens of entries. `null` means no answer (bridge unavailable, Steam
 * didn't respond, or an empty list), and the installed cache must not be touched.
 */
export async function installedWorkshopGameIds(
  targets: WorkshopTarget[]
): Promise<string[] | null> {
  const valid = targets.filter((t) => isValidTarget(t.steam_app_id, t.workshop_id));
  if (valid.length === 0) {
    return null;
  }
  if (!(await isCefUsable())) {
    return null;
  }

  const payload = jsLiteral(
    valid.map((t) => ({ id: t.id, appId: t.steam_app_id, itemId: t.workshop_id }))
  );

  try {
    const answer = await evaluateInSharedJsContext<string[] | 'unknown'>(
      `(async () => {
        if (typeof SteamClient?.Apps?.GetDownloadedWorkshopItems !== 'function') {
          return 'unknown';
        }
        const targets = ${payload};
        const byApp = new Map();
        const found = [];
        for (const t of targets) {
          if (!byApp.has(t.appId)) {
            try {
              const items = await SteamClient.Apps.GetDownloadedWorkshopItems(t.appId);
              if (!Array.isArray(items)) {
                return 'unknown';
              }
              byApp.set(t.appId, items);
            } catch {
              return 'unknown';
            }
          }
          const items = byApp.get(t.appId);
          if (items.some((i) => String(i.publishedfileid) === t.itemId)) {
            found.push(t.id);
          }
        }
        return found;
      })()`
    );
    return answer === 'unknown' ? null : answer;
  } catch (error) {
    console.error('[SteamWorkshop] bulk download check failed:', error);
    return null;
  }
}

/**
 * Both values flow into JS that runs in Steam's privileged context, and a
 * number annotation across the IPC boundary guarantees nothing at runtime.
 */
function isValidTarget(appId: number, workshopId: string): boolean {
  if (!Number.isInteger(appId) || appId <= 0) {
    console.error('[SteamWorkshop] Rejected non-integer appId:', appId);
    return false;
  }
  if (!/^\d+$/.test(workshopId)) {
    console.error('[SteamWorkshop] Rejected non-numeric workshopId:', workshopId);
    return false;
  }
  return true;
}

/** Whether the translation is on disk; `null` means no bridge, cache stays as-is. */
export async function isWorkshopItemDownloaded(
  appId: number,
  workshopId: string
): Promise<boolean | null> {
  if (!isValidTarget(appId, workshopId)) {
    return null;
  }
  if (!(await isCefUsable())) {
    return null;
  }

  try {
    const answer = await evaluateInSharedJsContext<boolean | 'unknown'>(
      `(async () => {
        if (typeof SteamClient?.Apps?.GetDownloadedWorkshopItems !== 'function') {
          return 'unknown';
        }
        try {
          const items = await SteamClient.Apps.GetDownloadedWorkshopItems(${appId});
          return Array.isArray(items)
            && items.some((i) => String(i.publishedfileid) === ${jsLiteral(workshopId)});
        } catch {
          return false;
        }
      })()`
    );
    return answer === 'unknown' ? null : answer;
  } catch (error) {
    console.error('[SteamWorkshop] download check failed:', error);
    return null;
  }
}

type SubscribeWorkshopResult =
  | { ok: true }
  | { ok: false; reason: SteamBridgeFailure; error?: string };

export async function setWorkshopSubscription(
  appId: number,
  workshopId: string,
  subscribe: boolean
): Promise<SubscribeWorkshopResult> {
  if (!isValidTarget(appId, workshopId)) {
    return { ok: false, reason: 'failed', error: 'Invalid appId or workshopId' };
  }

  const blocked = await ensureCefBridge();
  if (blocked) {
    return { ok: false, reason: blocked };
  }

  try {
    // The method returns nothing — success here just means "Steam accepted the command"
    await evaluateInSharedJsContext(
      `SteamClient.Apps.SubscribeWorkshopItem(${appId}, ${jsLiteral(workshopId)}, ${subscribe})`
    );
    console.log(
      `[SteamWorkshop] ${subscribe ? 'Subscribed to' : 'Unsubscribed from'} ${workshopId} (app ${appId}) via CEF`
    );
    return { ok: true };
  } catch (error) {
    console.error('[SteamWorkshop] CEF subscription change failed:', error);
    return {
      ok: false,
      reason: 'failed',
      error: error instanceof Error ? error.message : 'CEF subscribe failed',
    };
  }
}
