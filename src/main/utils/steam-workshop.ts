/**
 * Підписка й відписка на переклад у Майстерні через CEF-місток Steam.
 *
 * Той самий шлях, яким ми вже правимо launch options і артворк:
 * `SteamClient.Apps.SubscribeWorkshopItem(appId, publishedFileId, subscribe)`
 * у контексті SharedJSContext. Сигнатуру звірено з бандлом самого клієнта
 * (`Subscribe(e,t){…(e,t,!0)}` / `Unsubscribe(e,t){…(e,t,!1)}`).
 *
 * Місток доступний не завжди: потрібен прапорець `.cef-enable-remote-debugging`,
 * перезапуск Steam і відсутність Millennium. Тому це прискорення, а не заміна —
 * рендерер за невдачі відкриває звичайний steam:// диплінк.
 */

import { isCefDebuggingEnabledInSettings } from '@/main/utils/cef-flag-file';
import { evaluateInSharedJsContext, isCefAvailable } from '@/main/utils/steam-cef';
import { isSteamRunning } from '@/main/utils/steam-launcher';

/** Рядок games як є — перейменовувати ці три поля дорогою нема навіщо */
export interface WorkshopTarget {
  id: string;
  steam_app_id: number;
  workshop_id: string;
}

/**
 * Які з перекладів уже лежать на диску. Один похід у Steam на весь список:
 * окрема CDP-сесія на кожен переклад коштувала б секунди при десятках записів.
 * `null` — відповіді немає (місток недоступний, Steam не відповів або каталог
 * порожній), і кеш встановлень чіпати не можна.
 */
export async function installedWorkshopGameIds(
  targets: WorkshopTarget[]
): Promise<string[] | null> {
  const valid = targets.filter((t) => isValidTarget(t.steam_app_id, t.workshop_id));
  if (valid.length === 0) {
    return null;
  }
  if (!(isCefDebuggingEnabledInSettings() && (await isCefAvailable()))) {
    return null;
  }

  const payload = JSON.stringify(
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
 * Обидва значення потрапляють у JS, який виконується в привілейованому контексті
 * Steam, а number-анотація на межі IPC у рантаймі нічого не гарантує.
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

/** Чи лежить переклад на диску; `null` — містка немає, кеш лишається як є. */
export async function isWorkshopItemDownloaded(
  appId: number,
  workshopId: string
): Promise<boolean | null> {
  if (!isValidTarget(appId, workshopId)) {
    return null;
  }
  if (!(isCefDebuggingEnabledInSettings() && (await isCefAvailable()))) {
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
            && items.some((i) => String(i.publishedfileid) === ${JSON.stringify(workshopId)});
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
  | {
      ok: false;
      reason: 'cef-unavailable' | 'steam-not-running' | 'failed';
      error?: string;
    };

export async function setWorkshopSubscription(
  appId: number,
  workshopId: string,
  subscribe: boolean
): Promise<SubscribeWorkshopResult> {
  if (!isValidTarget(appId, workshopId)) {
    return { ok: false, reason: 'failed', error: 'Invalid appId or workshopId' };
  }

  if (!(await isSteamRunning())) {
    return { ok: false, reason: 'steam-not-running' };
  }

  if (!(isCefDebuggingEnabledInSettings() && (await isCefAvailable()))) {
    return { ok: false, reason: 'cef-unavailable' };
  }

  try {
    // Метод нічого не повертає — успіх тут означає лише «Steam прийняв команду»
    await evaluateInSharedJsContext(
      `SteamClient.Apps.SubscribeWorkshopItem(${appId}, ${JSON.stringify(workshopId)}, ${subscribe})`
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
