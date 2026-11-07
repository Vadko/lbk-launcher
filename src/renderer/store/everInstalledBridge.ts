import { useEverInstalledStore } from './useEverInstalledStore';
import { useStore } from './useStore';
import { useWorkshopInstallsStore } from './useWorkshopInstallsStore';

// A failed file install does not count
const installedIds = (): string[] => [
  ...[...useStore.getState().installedTranslations].flatMap(([gameId, info]) =>
    info.hasInstallError ? [] : [gameId]
  ),
  ...Object.keys(useWorkshopInstallsStore.getState().installedAt),
];

export function initEverInstalled(): void {
  const track = () => useEverInstalledStore.getState().markInstalled(installedIds());
  useStore.subscribe((state, prev) => {
    if (state.installedTranslations !== prev.installedTranslations) {
      track();
    }
  });
  useWorkshopInstallsStore.subscribe((state, prev) => {
    if (state.installedAt !== prev.installedAt) {
      track();
    }
  });
  track();
}
