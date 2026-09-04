/** steam:// не спрацює без зареєстрованого протоколу — тоді ведемо у браузер */
export async function openWorkshopPage(workshopId: string): Promise<void> {
  const result = await window.electronAPI.openExternal(
    `steam://url/CommunityFilePage/${workshopId}`
  );
  if (!result.success) {
    await window.electronAPI.openExternal(
      `https://steamcommunity.com/sharedfiles/filedetails/?id=${workshopId}`
    );
  }
}
