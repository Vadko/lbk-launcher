/** steam:// won't work without a registered protocol handler — fall back to the browser then */
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
