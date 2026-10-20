/**
 * Syncs the Steam library collection «З українізаторами» through the Steam
 * bridge — the same path `steam-workshop.ts` uses to subscribe to the Workshop.
 * The in-page body is the `syncCollection` op in `packages/lbk-bridge-core/src/ops.ts`.
 *
 * The steps were reverse-engineered against `collectionStore` in SharedJSContext
 * (the same JS store the Steam library uses for drag-and-drop between collections):
 *
 *   - `collectionStore.GetUserCollectionsByName(name)` — find our collection by
 *     name so repeated button presses do not pile up duplicates.
 *   - `collectionStore.NewUnsavedCollection(name, null, apps)` +
 *     `SaveCollection(coll)` — create a new one. The second argument is the
 *     collection filter (the one driving "smart" rules such as "installed");
 *     `null` is deliberate here: `UpdateApps` in the client treats a falsy filter as
 *     "membership is purely manual", which is what we want, and it also frees us
 *     from depending on the user having at least one collection of their own to
 *     borrow a working filter instance from.
 *   - `collectionStore.AddOrRemoveApp(appIds, add, collectionId)` — add or
 *     remove games from an existing collection.
 *
 * `collectionStore.allGamesCollection.allApps` is the source of truth for what
 * is "available on Steam" for this account: the catalog is intersected with that
 * list right inside the op, with no separate trip through
 * `getSteamLibraryAppIds()` on disk.
 *
 * We only remove games from the collection we created ourselves (its id is stored
 * per account): a same-named collection the user assembled by hand is only added
 * to — otherwise one click would wipe everything not in the catalog out of it.
 */

import { getCurrentSteamAccountId } from '@/main/game-detector/steam';
import { ensureSteamBridge } from '@/main/utils/steam-bridge';
import {
  readSteamAccountValue,
  writeSteamAccountValue,
} from '@/main/utils/store-storage';
import { errorMessage } from '@/shared/errors';
import { t } from '@/shared/i18n/i18n';
import type { SteamCollectionSyncFailure } from '@/shared/types';

const RECORD_KEY = 'steam-collection';
const MAX_APP_ID = 4294967295;

type SyncTranslatedCollectionResult =
  | { ok: true; total: number }
  | { ok: false; reason: SteamCollectionSyncFailure; error?: string };

/**
 * Creates (when missing) or updates the collection so it ends up holding those
 * `appIds` present in this user's Steam library. For our own collection the extras
 * are removed; for a same-named foreign one we only add.
 */
export async function syncTranslatedGamesCollection(
  appIds: number[]
): Promise<SyncTranslatedCollectionResult> {
  const valid = [
    ...new Set(appIds.filter((id) => Number.isInteger(id) && id > 0 && id <= MAX_APP_ID)),
  ];
  if (valid.length === 0) {
    return { ok: false, reason: 'no-translated-games' };
  }

  const bridge = await ensureSteamBridge();
  if (typeof bridge === 'string') {
    return { ok: false, reason: bridge };
  }

  const accountId = getCurrentSteamAccountId();
  const stored = accountId ? readSteamAccountValue(RECORD_KEY, accountId) : null;
  const recordedId = typeof stored === 'string' && stored.length <= 128 ? stored : null;

  try {
    const result = await bridge.invoke('syncCollection', {
      name: t('steamCollection.name'),
      appIds: valid,
      recordedId,
    });

    if (result === 'library-unavailable' || result === 'no-matches') {
      return { ok: false, reason: result };
    }
    if (typeof result !== 'object' || result === null) {
      return { ok: false, reason: 'failed' };
    }
    if ('error' in result) {
      console.error('[SteamCollections] In-page failure:', result.error);
      return { ok: false, reason: 'failed', error: result.error };
    }

    if (accountId && result.collectionId) {
      writeSteamAccountValue(RECORD_KEY, accountId, result.collectionId);
    }

    console.log(
      `[SteamCollections] ${result.created ? 'created' : 'updated'}, total=${result.total}, +${result.added}/-${result.removed}`
    );
    return { ok: true, total: result.total };
  } catch (error) {
    console.error('[SteamCollections] Sync failed:', error);
    return {
      ok: false,
      reason: 'failed',
      error: errorMessage(error, 'Bridge sync failed'),
    };
  }
}
