import { Download, Trash2 } from 'lucide';
import { ExternalLink } from 'lucide-react';
import { useEffect } from 'react';
import { useActionPhase } from '../../hooks/useActionPhase';
import { useWorkshopInstallsStore } from '../../store/useWorkshopInstallsStore';
import { openWorkshopPage } from '../../utils/workshopPage';
import { AppActionIcon } from './AppActionIcon';
import { Button } from './Button';
import { Tooltip } from './Tooltip';

interface WorkshopInstallButtonProps {
  gameId: string;
  workshopId: string;
  steamAppId: number | null;
  isGameInstalledOnSystem: boolean;
  isOnline: boolean;
  isTombstoned: boolean;
}

export function WorkshopInstallButton({
  gameId,
  workshopId,
  steamAppId,
  isGameInstalledOnSystem,
  isOnline,
  isTombstoned,
}: WorkshopInstallButtonProps) {
  const installed = useWorkshopInstallsStore((s) => Boolean(s.installedAt[gameId]));
  const pending = useWorkshopInstallsStore((s) => s.pending[gameId]);
  const reconcile = useWorkshopInstallsStore((s) => s.reconcile);
  const install = useWorkshopInstallsStore((s) => s.install);
  const remove = useWorkshopInstallsStore((s) => s.remove);
  const installAction = useActionPhase();
  const removeAction = useActionPhase();

  useEffect(() => {
    if (steamAppId) {
      void reconcile(gameId, steamAppId, workshopId);
    }
  }, [gameId, steamAppId, workshopId, reconcile]);

  const installPhase =
    pending && pending !== 'removing' ? 'pending' : installAction.phase;
  const removePhase = pending === 'removing' ? 'pending' : removeAction.phase;
  const isPending = Boolean(pending) || installAction.isPending || removeAction.isPending;

  const handleInstall = async () => {
    if (isPending) {
      return;
    }
    const ok = await installAction.attempt(
      () => install({ gameId, appId: steamAppId, workshopId }),
      { isSuccess: (ok) => ok, label: 'WorkshopInstallButton.install' }
    );
    if (ok) {
      installAction.reset();
    }
  };

  const handleRemove = async () => {
    if (isPending) {
      return;
    }
    const ok = await removeAction.attempt(
      () => remove({ gameId, appId: steamAppId, workshopId }),
      { isSuccess: (ok) => ok, label: 'WorkshopInstallButton.remove' }
    );
    if (ok) {
      removeAction.reset();
    }
  };

  const hint = isTombstoned
    ? 'Переклад більше не доступний у каталозі'
    : !isOnline
      ? 'Відсутнє підключення до Інтернету'
      : !isGameInstalledOnSystem
        ? 'Гру не встановлено на цьому пристрої'
        : pending === 'downloading'
          ? 'Прогрес показано в клієнті Steam'
          : null;

  return (
    <>
      {!installed && (
        <Tooltip content={hint}>
          <Button
            variant="primary"
            icon={
              <AppActionIcon
                phase={installPhase}
                icon={Download}
                size={20}
                inheritColor
              />
            }
            onClick={() => void handleInstall()}
            aria-busy={installPhase === 'pending'}
            disabled={!isOnline || isTombstoned || !isGameInstalledOnSystem || isPending}
            className="aria-busy:cursor-wait"
            data-gamepad-primary-action
            data-gamepad-action
          >
            Встановити зі Steam
          </Button>
        </Tooltip>
      )}
      <Button
        variant="secondary"
        icon={<ExternalLink size={20} />}
        onClick={() => void openWorkshopPage(workshopId)}
        title="Відкрити сторінку в Майстерні"
        data-gamepad-action
      >
        Майстерня
      </Button>
      {installed && (
        <Button
          variant="secondary"
          icon={<AppActionIcon phase={removePhase} icon={Trash2} size={20} />}
          onClick={() => void handleRemove()}
          aria-busy={removePhase === 'pending'}
          disabled={isPending}
          className="aria-busy:cursor-wait"
          title="Скасувати підписку в Steam"
          data-gamepad-action
        />
      )}
    </>
  );
}
