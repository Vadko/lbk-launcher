/**
 * Subscribe/unsubscribe a translation in the Workshop via the Steam bridge.
 *
 * `SteamClient.Apps.SubscribeWorkshopItem(appId, publishedFileId, subscribe)`
 * in SharedJSContext (CDP) or via the LBK Bridge Millennium plugin. The signature
 * was checked against the client's own bundle
 * (`Subscribe(e,t){…(e,t,!0)}` / `Unsubscribe(e,t){…(e,t,!1)}`).
 *
 * The bridge is not always available, so this is an optimization, not a
 * replacement — the renderer falls back to a plain steam:// deep link on failure.
 */

import { ensureSteamBridge, getSteamBridge } from '@/main/utils/steam-bridge';
import { errorMessage } from '@/shared/errors';
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
  const bridge = await getSteamBridge();
  if (!bridge) {
    return null;
  }

  try {
    const answer = await bridge.invoke('workshopDownloaded', {
      targets: valid.map((t) => ({
        id: t.id,
        appId: t.steam_app_id,
        itemId: t.workshop_id,
      })),
    });
    return answer === 'unknown' ? null : answer;
  } catch (error) {
    console.error('[SteamWorkshop] bulk download check failed:', error);
    return null;
  }
}

const MAX_APP_ID = 4294967295;

/**
 * Both values flow into JS that runs in Steam's privileged context, and a
 * number annotation across the IPC boundary guarantees nothing at runtime.
 * The bounds match the in-page validators, so one bad row can't fail a whole batch.
 */
function isValidTarget(appId: number, workshopId: string): boolean {
  if (!Number.isInteger(appId) || appId <= 0 || appId > MAX_APP_ID) {
    console.error('[SteamWorkshop] Rejected non-integer appId:', appId);
    return false;
  }
  if (typeof workshopId !== 'string' || !/^\d{1,20}$/.test(workshopId)) {
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
  const bridge = await getSteamBridge();
  if (!bridge) {
    return null;
  }

  try {
    const answer = await bridge.invoke('workshopDownloaded', {
      targets: [{ id: workshopId, appId, itemId: workshopId }],
    });
    return answer === 'unknown' ? null : answer.length === 1;
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

  const bridge = await ensureSteamBridge();
  if (typeof bridge === 'string') {
    return { ok: false, reason: bridge };
  }

  try {
    // The method returns nothing — success here just means "Steam accepted the command"
    await bridge.invoke('workshopSubscribe', { appId, itemId: workshopId, subscribe });
    console.log(
      `[SteamWorkshop] ${subscribe ? 'Subscribed to' : 'Unsubscribed from'} ${workshopId} (app ${appId}) via ${bridge.transport}`
    );
    return { ok: true };
  } catch (error) {
    console.error('[SteamWorkshop] Bridge subscription change failed:', error);
    return {
      ok: false,
      reason: 'failed',
      error: errorMessage(error, 'Bridge subscribe failed'),
    };
  }
}
