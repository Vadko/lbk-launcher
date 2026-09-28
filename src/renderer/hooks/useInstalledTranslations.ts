import { useCallback, useEffect } from 'react';
import { useEverInstalledStore } from '../store/useEverInstalledStore';
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

// Раз встановлений переклад лишається "встановлюваним" для лайків/відгуків назавжди
export function useHasEverInstalledTranslation(gameId: string | undefined): boolean {
  return useEverInstalledStore((state) =>
    gameId ? Boolean(state.installedAt[gameId]) : false
  );
}

export function useTrackEverInstalledTranslations(): void {
  const fileBased = useStore((state) => state.installedTranslations);
  const workshop = useWorkshopInstallsStore((state) => state.installedAt);
  const markInstalled = useEverInstalledStore((state) => state.markInstalled);

  useEffect(() => {
    fileBased.forEach((info, gameId) => {
      if (!info.hasInstallError) {
        markInstalled(gameId);
      }
    });
    Object.keys(workshop).forEach(markInstalled);
  }, [fileBased, workshop, markInstalled]);
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
