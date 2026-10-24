async function openWithFallback(primary: string, fallback: string): Promise<void> {
  const result = await window.electronAPI.openExternal(primary);
  if (!result.success) {
    await window.electronAPI.openExternal(fallback);
  }
}

export async function openWorkshopPage(workshopId: string): Promise<void> {
  await openWithFallback(
    `steam://url/CommunityFilePage/${workshopId}`,
    `https://steamcommunity.com/sharedfiles/filedetails/?id=${workshopId}`
  );
}

export async function openSteamPage(steamId: string | number): Promise<void> {
  await openWithFallback(
    `steam://store/${steamId}`,
    `https://store.steampowered.com/app/${steamId}`
  );
}

// export async function openSteamLibraryPage(steamId: string | number): Promise<void> {
//   await openWithFallback(
//     `steam://nav/games/details/${steamId}`,
//     `https://store.steampowered.com/app/${steamId}`
//   );
// }
