/**
 * Синхронізація бібліотечної колекції Steam «З українізаторами» через
 * CEF-місток — той самий шлях, яким `steam-workshop.ts` підписує на Майстерню.
 *
 * Кроки, реверс-інжинирені проти `collectionStore` у SharedJSContext (той
 * самий JS-стор, яким бібліотека Steam керує drag-n-drop по колекціях):
 *
 *   - `collectionStore.GetUserCollectionsByName(name)` — знайти нашу колекцію
 *     за назвою, щоб не плодити дублікати при повторних натисканнях кнопки.
 *   - `collectionStore.NewUnsavedCollection(name, null, apps)` +
 *     `SaveCollection(coll)` — створити нову. Другий аргумент — фільтр
 *     колекції (той, що керує «розумними» правилами на кшталт «встановлені»);
 *     `null` тут навмисно: `UpdateApps` у клієнті trактує falsy-фільтр як
 *     «членство суто ручне», що нам і треба, і водночас це звільняє від
 *     залежності від того, чи є в користувача хоч одна власна колекція, звідки
 *     можна було б позичити робочий екземпляр фільтра.
 *   - `collectionStore.AddOrRemoveApp(appIds, add, collectionId)` — додати чи
 *     прибрати ігри з уже наявної колекції.
 *
 * `collectionStore.allGamesCollection.allApps` — джерело правди про те, що
 * саме «доступно зі Steam» для цього акаунта: перетин каталогу перекладів із
 * цим списком робимо прямо в CEF-виразі, без окремого походу через
 * `getSteamLibraryAppIds()` з диска.
 *
 * Прибираємо ігри лише з колекції, яку створили самі (її id записано на
 * акаунт): однойменну колекцію, зібрану користувачем вручну, тільки
 * доповнюємо — інакше один клік вимів би звідти все, чого немає в каталозі.
 */

import { getCurrentSteamAccountId } from '@/main/game-detector/steam';
import {
  ensureCefBridge,
  evaluateInSharedJsContext,
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
 * Створює (за відсутності) або оновлює колекцію так, щоб у ній опинилися ті
 * ігри з `appIds`, які є в бібліотеці Steam цього користувача. Для власної
 * колекції зайве прибирається, для чужої однойменної — лише додається.
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
          const NAME = ${JSON.stringify(COLLECTION_NAME)};
          const targetIds = new Set(${JSON.stringify(valid)});
          const recordedId = ${JSON.stringify(recordedId)};

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
