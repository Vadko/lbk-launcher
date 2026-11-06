import { queryOptions, skipToken } from '@tanstack/react-query';

// Installs and uninstalls change it in main, so it is read again before every install dialog.
export const steamArtworkAppliedQuery = (appId: number | null) =>
  queryOptions({
    queryKey: ['steam-artwork-applied', appId],
    queryFn: appId ? () => window.electronAPI.isSteamArtworkApplied(appId) : skipToken,
    staleTime: 0,
  });
