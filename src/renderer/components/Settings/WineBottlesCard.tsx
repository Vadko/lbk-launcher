import { FolderPlusIcon, WineIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { t } from '@/shared/i18n/i18n';
import { useRefreshedResource } from '../../hooks/useRefreshedResource';
import { Button } from '../ui/Button';

interface WineBottlesCardProps {
  isOpen: boolean;
}

export function WineBottlesCard({ isOpen }: WineBottlesCardProps) {
  // Steam installed into a bottle LBK already lists changes no prefix, so an open reads the bottles again
  const bottles = useRefreshedResource('wineBottles', isOpen);
  const [notice, setNotice] = useState<string | null>(null);

  const addBottle = () => {
    setNotice(null);
    window.electronAPI
      .addWinePrefix()
      .then((result) => {
        if (!result.success && result.error !== 'cancelled') {
          setNotice(t(`settings.wine.addFailed_${result.error}`));
        }
      })
      .catch((error: unknown) => {
        console.error('[Settings] Adding a Wine bottle failed:', error);
        setNotice(t('settings.wine.addFailed_failed'));
      });
  };

  return (
    <div className="w-full flex flex-col gap-3 p-4 rounded-xl bg-glass border border-border">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-color-main flex items-center justify-center shrink-0">
          <WineIcon size={20} className="text-text-dark" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-text-main">
            {t('settings.wine.title')}
          </h4>
          <p className="text-xs text-text-muted">{t('settings.wine.description')}</p>
        </div>
      </div>

      {bottles.status === 'ready' && bottles.value.length === 0 && (
        <p className="text-xs text-text-muted">{t('settings.wine.none')}</p>
      )}
      {bottles.status === 'ready' && bottles.value.length > 0 && (
        <ul className="flex flex-col gap-1">
          {bottles.value.map((bottle) => (
            <li
              key={bottle.prefix}
              className="flex items-center gap-2 text-sm text-text-main"
              title={bottle.prefix}
            >
              <span className="truncate">{bottle.label}</span>
              <span className="text-xs text-text-muted shrink-0">
                {bottle.hasSteam
                  ? t('settings.wine.withSteam')
                  : t('settings.wine.noSteam')}
              </span>
              {bottle.userAdded && (
                <button
                  type="button"
                  onClick={() => void window.electronAPI.removeWinePrefix(bottle.prefix)}
                  className="ml-auto p-1 rounded-md text-text-muted hover:text-text-main hover:bg-glass-hover"
                  aria-label={t('settings.wine.remove', { bottle: bottle.label })}
                  data-gamepad-action
                >
                  <XIcon size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {notice && <p className="text-xs text-red-400">{notice}</p>}

      <Button
        variant="secondary"
        onClick={addBottle}
        icon={<FolderPlusIcon size={16} />}
        data-gamepad-action
      >
        {t('settings.wine.add')}
      </Button>
    </div>
  );
}
