import { useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useWorkshopInstallsStore } from '../store/useWorkshopInstallsStore';

export function useIsTranslationInstalled(): (gameId: string) => boolean {
  const fileBased = useStore((state) => state.installedTranslations);
  const workshop = useWorkshopInstallsStore((state) => state.installedAt);

  return useCallback(
    (gameId: string) => fileBased.has(gameId) || Boolean(workshop[gameId]),
    [fileBased, workshop]
  );
}

// Суворіше за предикат списків: збійне встановлення не рахуємо
export function useIsTranslationInstalledForGame(gameId: string | undefined): boolean {
  const info = useStore((state) =>
    gameId ? state.installedTranslations.get(gameId) : undefined
  );
  const inWorkshop = useWorkshopInstallsStore((state) =>
    gameId ? Boolean(state.installedAt[gameId]) : false
  );

  return inWorkshop || Boolean(info && !info.hasInstallError);
}

export function useIsWorkshopChangePending(gameId: string | undefined): boolean {
  return useWorkshopInstallsStore((state) =>
    gameId ? Boolean(state.pending[gameId]) : false
  );
}

export async function allInstalledTranslationIds(): Promise<string[]> {
  const fileBased = await window.electronAPI.getAllInstalledGameIds();
  const workshop = Object.keys(useWorkshopInstallsStore.getState().installedAt);

  return [...new Set(fileBased.concat(workshop))];
}
