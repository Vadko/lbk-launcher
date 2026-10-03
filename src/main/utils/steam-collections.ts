/**
 * Syncs the Steam library collection «З українізаторами» through the CEF
 * bridge — the same path `steam-workshop.ts` uses to subscribe to the Workshop.
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
 * list right inside the CEF expression, with no separate trip through
 * `getSteamLibraryAppIds()` on disk.
 *
 * We only remove games from the collection we created ourselves (its id is stored
 * per account): a same-named collection the user assembled by hand is only added
 * to — otherwise one click would wipe everything not in the catalog out of it.
 */

import { getCurrentSteamAccountId } from '@/main/game-detector/steam';
import {
  ensureCefBridge,
  evaluateInSharedJsContext,
  jsLiteral,
  libraryAppsGuard,
} from '@/main/utils/steam-cef';
import {
  readSteamAccountValue,
  writeSteamAccountValue,
} from '@/main/utils/store-storage';
import type { SteamCollectionSyncFailure } from '@/shared/types';

const COLLECTION_NAME = 'З українізаторами';
const RECORD_KEY = 'steam-collection';

interface SyncStats {
  created: boolean;
  total: number;
  added: number;
  removed: number;
}

type CefSyncAnswer =
  | (SyncStats & { collectionId: string | null })
  | 'library-unavailable'
  | 'no-matches'
  | { error: string };

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
  const valid = [...new Set(appIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (valid.length === 0) {
    return { ok: false, reason: 'no-translated-games' };
  }

  const blocked = await ensureCefBridge();
  if (blocked) {
    return { ok: false, reason: blocked };
  }

  const accountId = getCurrentSteamAccountId();
  const stored = accountId ? readSteamAccountValue(RECORD_KEY, accountId) : null;
  const recordedId = typeof stored === 'string' ? stored : null;

  try {
    const result = await evaluateInSharedJsContext<CefSyncAnswer>(
      `(async () => {
        try {
          const NAME = ${jsLiteral(COLLECTION_NAME)};
          const targetIds = new Set(${jsLiteral(valid)});
          const recordedId = ${jsLiteral(recordedId)};

          ${libraryAppsGuard("'library-unavailable'")}

          const owned = apps.filter((a) => targetIds.has(a.appid));
          const wantedIds = new Set(owned.map((a) => a.appid));

          const byName = collectionStore.GetUserCollectionsByName(NAME) || [];
          const coll =
            (recordedId && byName.find((c) => c.id === recordedId)) || byName[0] || null;

          if (!coll) {
            if (owned.length === 0) {
              return 'no-matches';
            }
            const fresh = collectionStore.NewUnsavedCollection(NAME, null, owned);
            await collectionStore.SaveCollection(fresh);
            const saved = collectionStore.GetUserCollectionsByName(NAME) || [];
            return {
              created: true,
              collectionId: (saved[0] && saved[0].id) || fresh.id || null,
              total: owned.length,
              added: owned.length,
              removed: 0,
            };
          }

          const mine =
            coll.id === recordedId || coll.allApps.every((a) => targetIds.has(a.appid));

          const currentIds = new Set(coll.allApps.map((a) => a.appid));
          const toAdd = [...wantedIds].filter((id) => !currentIds.has(id));
          const toRemove = mine
            ? [...currentIds].filter((id) => !wantedIds.has(id))
            : [];

          if (toAdd.length > 0) {
            await collectionStore.AddOrRemoveApp(toAdd, true, coll.id);
          }
          if (toRemove.length > 0) {
            await collectionStore.AddOrRemoveApp(toRemove, false, coll.id);
          }

          return {
            created: false,
            collectionId: mine ? coll.id : null,
            total: currentIds.size + toAdd.length - toRemove.length,
            added: toAdd.length,
            removed: toRemove.length,
          };
        } catch (e) {
          return { error: String((e && e.message) || e) };
        }
      })()`
    );

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
      `[SteamCollections] "${COLLECTION_NAME}": ${result.created ? 'created' : 'updated'}, total=${result.total}, +${result.added}/-${result.removed}`
    );
    return { ok: true, total: result.total };
  } catch (error) {
    console.error('[SteamCollections] Sync failed:', error);
    return {
      ok: false,
      reason: 'failed',
      error: error instanceof Error ? error.message : 'CEF sync failed',
    };
  }
}
