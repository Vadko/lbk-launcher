import { Download, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useWorkshopInstallsStore } from '../../store/useWorkshopInstallsStore';
import { openWorkshopPage } from '../../utils/workshopPage';
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

  useEffect(() => {
    if (steamAppId) {
      void reconcile(gameId, steamAppId, workshopId);
    }
  }, [gameId, steamAppId, workshopId, reconcile]);

  const label = pending
    ? pending === 'removing'
      ? 'Видалення в Steam…'
      : 'Завантаження в Steam…'
    : 'Встановити зі Steam';

  const hint = isTombstoned
    ? 'Переклад більше не доступний у каталозі'
    : !isOnline
      ? 'Відсутнє підключення до Інтернету'
      : !isGameInstalledOnSystem
        ? 'Гру не встановлено на цьому пристрої'
        : pending === 'downloading'
          ? 'Прогрес показано в клієнті Steam'
          : null;

  const showActionSlot = !installed || Boolean(pending);

  const icon = pending ? (
    <RefreshCw size={20} className="animate-spin" />
  ) : (
    <Download size={20} />
  );

  return (
    <>
      {showActionSlot && (
        <Tooltip content={hint}>
          <Button
            variant="primary"
            icon={icon}
            onClick={() => void install({ gameId, appId: steamAppId, workshopId })}
            disabled={
              !isOnline || isTombstoned || !isGameInstalledOnSystem || Boolean(pending)
            }
            data-gamepad-primary-action
            data-gamepad-action
          >
            {label}
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
      {installed && !pending && (
        <Button
          variant="secondary"
          icon={<Trash2 size={20} />}
          onClick={() => void remove({ gameId, appId: steamAppId, workshopId })}
          title="Скасувати підписку в Steam"
          data-gamepad-action
        />
      )}
    </>
  );
}
