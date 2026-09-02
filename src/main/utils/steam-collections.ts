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
 */

import { isCefDebuggingEnabledInSettings } from '@/main/utils/cef-flag-file';
import { evaluateInSharedJsContext, isCefAvailable } from '@/main/utils/steam-cef';
import { isSteamRunning } from '@/main/utils/steam-launcher';

const COLLECTION_NAME = 'З українізаторами';

interface SyncStats {
  created: boolean;
  total: number;
  added: number;
  removed: number;
}

type SyncTranslatedCollectionResult =
  | ({ ok: true } & SyncStats)
  | {
      ok: false;
      reason:
        | 'cef-unavailable'
        | 'steam-not-running'
        | 'no-translated-games'
        | 'no-matches'
        | 'failed';
      error?: string;
    };

/**
 * Створює (за відсутності) або оновлює колекцію так, щоб у ній опинилися рівно
 * ті ігри з `appIds`, які є в бібліотеці Steam цього користувача — не більше
 * й не менше, тобто повторний виклик прибирає ігри, чий переклад зник із
 * каталогу відтоді.
 */
export async function syncTranslatedGamesCollection(
  appIds: number[]
): Promise<SyncTranslatedCollectionResult> {
  const valid = [...new Set(appIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (valid.length === 0) {
    return { ok: false, reason: 'no-translated-games' };
  }

  if (!(await isSteamRunning())) {
    return { ok: false, reason: 'steam-not-running' };
  }

  if (!(isCefDebuggingEnabledInSettings() && (await isCefAvailable()))) {
    return { ok: false, reason: 'cef-unavailable' };
  }

  try {
    const result = await evaluateInSharedJsContext<SyncStats | 'no-matches' | 'failed'>(
      `(() => {
        try {
          const NAME = ${JSON.stringify(COLLECTION_NAME)};
          const targetIds = new Set(${JSON.stringify(valid)});

          const owned = collectionStore.allGamesCollection.allApps.filter(
            (a) => targetIds.has(a.appid)
          );
          const ownedIds = owned.map((a) => a.appid);

          const existing = collectionStore.GetUserCollectionsByName(NAME);
          const coll = existing && existing[0];

          if (!coll) {
            if (owned.length === 0) {
              return 'no-matches';
            }
            const created = collectionStore.NewUnsavedCollection(NAME, null, owned);
            collectionStore.SaveCollection(created);
            return { created: true, total: owned.length, added: owned.length, removed: 0 };
          }

          const currentIds = new Set(coll.allApps.map((a) => a.appid));
          const wantedIds = new Set(ownedIds);
          const toAdd = ownedIds.filter((id) => !currentIds.has(id));
          const toRemove = [...currentIds].filter((id) => !wantedIds.has(id));

          if (toAdd.length > 0) {
            collectionStore.AddOrRemoveApp(toAdd, true, coll.id);
          }
          if (toRemove.length > 0) {
            collectionStore.AddOrRemoveApp(toRemove, false, coll.id);
          }

          return {
            created: false,
            total: owned.length,
            added: toAdd.length,
            removed: toRemove.length,
          };
        } catch (e) {
          return 'failed';
        }
      })()`
    );

    if (result === 'failed') {
      return { ok: false, reason: 'failed' };
    }
    if (result === 'no-matches') {
      return { ok: false, reason: 'no-matches' };
    }

    console.log(
      `[SteamCollections] "${COLLECTION_NAME}": ${result.created ? 'created' : 'updated'}, total=${result.total}, +${result.added}/-${result.removed}`
    );
    return { ok: true, ...result };
  } catch (error) {
    console.error('[SteamCollections] Sync failed:', error);
    return {
      ok: false,
      reason: 'failed',
      error: error instanceof Error ? error.message : 'CEF sync failed',
    };
  }
}
