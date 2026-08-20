/**
 * Відкрити steam:// deep link; якщо не вдалось (напр. Steam не встановлено) -
 * фолбек на веб-сторінку в браузері. Той самий підхід, що й openInTelegram
 * в NewsFeedSection.tsx: без визначення "чи встановлено застосунок" в main
 * процесі - просто пробуємо протокол і дивимось на результат openExternal.
 */
async function openViaSteamOrBrowser(
  steamUrl: string,
  browserUrl: string
): Promise<void> {
  const result = await window.electronAPI.openExternal(steamUrl);
  if (!result.success) {
    window.electronAPI.openExternal(browserUrl);
  }
}

export function openSteamWorkshopItem(workshopId: string): Promise<void> {
  return openViaSteamOrBrowser(
    `steam://url/CommunityFilePage/${workshopId}`,
    `https://steamcommunity.com/sharedfiles/filedetails/?id=${workshopId}`
  );
}

export function openSteamStorePage(appId: number): Promise<void> {
  return openViaSteamOrBrowser(
    `steam://store/${appId}`,
    `https://store.steampowered.com/app/${appId}`
  );
}
