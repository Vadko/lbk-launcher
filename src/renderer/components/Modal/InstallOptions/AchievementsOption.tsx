import { ArchiveIcon, CheckIcon, InfoIcon, Trash2Icon, TrophyIcon } from 'lucide-react';
import React from 'react';
import { t } from '@/shared/i18n/i18n';
import type { AchievementsBadge } from '@/shared/plugin-host-types';
import type { Game } from '@/shared/types';
import type { AchievementsOptionState } from '../../../utils/installOptions';
import { AchievementsDeliveryBadge } from '../../ui/AchievementsDeliveryBadge';
import { AchievementsDeliveryNote } from './AchievementsDeliveryNote';

const PLANNED_CHANGES = [
  ['willRemove', t('installOptions.willRemove'), Trash2Icon, 'text-red-400'],
  ['willDownload', t('installOptions.willDownload'), ArchiveIcon, 'text-green-400'],
  ['willReinstall', t('installOptions.willReinstall'), ArchiveIcon, 'text-green-400'],
] as const;

interface AchievementsOptionProps {
  game: Game;
  hasArchive: boolean;
  installed: boolean;
  badge: AchievementsBadge | null;
  option: AchievementsOptionState;
  onToggle: (checked: boolean) => void;
}

export const AchievementsOption: React.FC<AchievementsOptionProps> = ({
  game,
  hasArchive,
  installed,
  badge,
  option,
  onToggle,
}) => (
  <>
    <label
      className={`flex items-start gap-4 group ${option.canToggle ? 'cursor-pointer' : 'cursor-not-allowed'} ${hasArchive ? '' : 'opacity-50'}`}
    >
      <div className="relative flex items-center justify-center mt-0.5">
        <input
          type="checkbox"
          checked={option.install}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={!option.canToggle}
          data-gamepad-modal-item
          className={`appearance-none w-5 h-5 rounded-md bg-glass border border-border checked:bg-color-main checked:border-color-main transition-colors focus:ring-2 focus:ring-color-main/50 focus:outline-hidden disabled:opacity-50 ${option.canToggle ? 'cursor-pointer' : 'cursor-not-allowed'}`}
        />
        <svg
          className={`absolute w-3 h-3 text-text-dark pointer-events-none transition-opacity ${
            option.install ? 'opacity-100' : 'opacity-0'
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <TrophyIcon
            size={18}
            className={option.canToggle ? 'text-green-400' : 'text-text-muted'}
          />
          <span
            className={`font-medium transition-colors ${option.canToggle ? 'text-text-main group-hover:text-green-400' : 'text-text-muted'}`}
          >
            {t('achievementsOption.title')}
          </span>
          {!hasArchive && (
            <span className="text-xs text-text-muted">
              {t('installOptions.unavailable')}
            </span>
          )}
          {option.checking && (
            <span className="text-xs text-text-muted">
              {t('achievementsOption.checking')}
            </span>
          )}
          {installed && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckIcon size={12} />
              {t('installOptions.installed')}
            </span>
          )}
          {hasArchive && badge && <AchievementsDeliveryBadge badge={badge} />}
        </div>
        <div className="text-sm text-text-muted mt-1">
          <p>{t('achievementsOption.description')}</p>
          {game.achievements_archive_size && (
            <p className="flex items-center gap-1 mt-1 text-green-400">
              <ArchiveIcon size={14} />
              <span>
                {t('installOptions.size', { size: game.achievements_archive_size })}
              </span>
            </p>
          )}
          {PLANNED_CHANGES.filter(([key]) => option[key]).map(
            ([key, text, Icon, color]) => (
              <p key={key} className={`flex items-center gap-1 mt-1 ${color}`}>
                <Icon size={14} />
                <span>{text}</span>
              </p>
            )
          )}
        </div>
      </div>
    </label>

    {hasArchive && badge && <AchievementsDeliveryNote badge={badge} />}

    {option.wants && game.achievements_third_party && (
      <div className="bg-glass rounded-xl p-3 border border-border flex items-center gap-2 text-sm">
        <InfoIcon size={16} className="text-color-main shrink-0" />
        <span className="text-text-muted">
          {t('achievementsOption.thirdPartyAuthor')}{' '}
          <span className="text-text-main">{game.achievements_third_party}</span>
        </span>
      </div>
    )}
  </>
);
