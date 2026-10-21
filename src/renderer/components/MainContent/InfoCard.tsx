import { motion } from 'framer-motion';
import {
  AwardIcon,
  BellIcon,
  CalendarClockIcon,
  CalendarIcon,
  CalendarPlusIcon,
  DownloadIcon,
  Gamepad2Icon,
  HardDriveIcon,
  TrophyIcon,
  Volume2Icon,
} from 'lucide-react';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { getReadablePlatform } from '@/renderer/helpers/getReadablePlatform.ts';
import { t } from '@/shared/i18n/i18n';
import type { Game } from '../../../shared/types';
import { getFeaturedInfo } from '../../constants/featuredTranslations';
import { AppNumberFlow } from '../ui/AppNumberFlow';
import { Tooltip } from '../ui/Tooltip';

interface InfoCardProps {
  game: Game;
}

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  compact?: boolean;
}

const InfoItem: React.FC<InfoItemProps> = ({ icon, label, value, compact }) => (
  <div className={`flex gap-3 ${compact ? 'items-center' : 'items-start'}`}>
    <div className={`text-color-main ${compact ? '' : 'mt-0.5'}`}>{icon}</div>
    <div
      className={`flex gap-1 transition-all duration-200 ${compact ? 'items-center flex-row' : 'flex-col'}`}
    >
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-sm font-medium text-text-main">{value}</div>
    </div>
  </div>
);

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) {
    return '';
  }
  return new Date(dateString).toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  });
};

export const InfoCard: React.FC<InfoCardProps> = ({ game }) => {
  const platformsText = game.platforms.map(getReadablePlatform).join(', ');
  const isPlanned = game.status === 'planned';
  const hasSubscriptions = !!game.subscriptions && game.subscriptions > 0;
  const featuredInfo = getFeaturedInfo(game.slug, game.team);
  const [compact, setCompact] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Update compact mode based on card width
  useLayoutEffect(() => {
    const updateCompactMode = () => {
      if (cardRef.current) {
        const width = cardRef.current.offsetWidth;
        setCompact(width < 500);
      }
    };

    updateCompactMode();

    const resizeObserver = new ResizeObserver(updateCompactMode);
    if (cardRef.current) {
      resizeObserver.observe(cardRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={cardRef} className="glass-card-no-motion">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-head font-semibold text-text-main">
          {t('gameInfo.title')}
        </h3>
        <div className="flex items-center gap-2">
          {featuredInfo && (
            <Tooltip content={featuredInfo.description} align="left">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 rounded-sm text-amber-400 text-xs cursor-help">
                <AwardIcon size={12} />
                <span>{t('gameInfo.award')}</span>
              </div>
            </Tooltip>
          )}
        </div>
      </div>
      <motion.div
        layout
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`grid ${compact ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-4'}`}
      >
        <motion.div layout transition={{ duration: 0.2 }}>
          <InfoItem
            icon={<Gamepad2Icon size={18} />}
            label={t('gameInfo.platforms')}
            value={platformsText}
            compact={compact}
          />
        </motion.div>
        {game.version && (
          <motion.div layout transition={{ duration: 0.2 }}>
            <InfoItem
              icon={<CalendarIcon size={18} />}
              label={t('gameInfo.version')}
              value={game.version}
              compact={compact}
            />
          </motion.div>
        )}
        {game.archive_size && (
          <motion.div layout transition={{ duration: 0.2 }}>
            <InfoItem
              icon={<HardDriveIcon size={18} />}
              label={t('gameInfo.size')}
              value={game.archive_size}
              compact={compact}
            />
          </motion.div>
        )}
        {game.voice_archive_size && (
          <motion.div layout transition={{ duration: 0.2 }}>
            <InfoItem
              icon={<Volume2Icon size={18} />}
              label={t('gameInfo.voice')}
              value={game.voice_archive_size}
              compact={compact}
            />
          </motion.div>
        )}
        {game.achievements_archive_size && (
          <motion.div layout transition={{ duration: 0.2 }}>
            <div className={`flex gap-3 ${compact ? 'items-center' : 'items-start'}`}>
              <div className={`text-color-main ${compact ? '' : 'mt-0.5'}`}>
                <TrophyIcon size={18} />
              </div>
              <div
                className={`flex gap-1 transition-all duration-200 ${compact ? 'items-center flex-row' : 'flex-col'}`}
              >
                <div className="text-xs text-text-muted">
                  {t('gameInfo.achievements')}
                </div>
                <div className="text-sm font-medium text-text-main">
                  {game.achievements_archive_size}
                </div>
                {game.achievements_third_party && (
                  <div className="text-xs text-text-muted mt-0.5">
                    {t('gameInfo.achievementsBy', {
                      author: game.achievements_third_party,
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
        {isPlanned && hasSubscriptions && (
          <motion.div layout transition={{ duration: 0.2 }}>
            <InfoItem
              icon={<BellIcon size={18} />}
              label={t('gameInfo.subscribers')}
              // Key by game: switching games isn't a value change, so there's nothing to animate
              value={<AppNumberFlow key={game.id} value={game.subscriptions!} />}
              compact={compact}
            />
          </motion.div>
        )}
        {!isPlanned && (
          <motion.div layout transition={{ duration: 0.2 }}>
            <InfoItem
              icon={<DownloadIcon size={18} />}
              label={t('gameInfo.downloads')}
              value={
                !game.downloads || game.downloads < 20 ? (
                  t('gameInfo.downloadsUnder20')
                ) : (
                  <AppNumberFlow key={game.id} value={game.downloads} />
                )
              }
              compact={compact}
            />
          </motion.div>
        )}
        {game.created_at && (
          <motion.div layout transition={{ duration: 0.2 }}>
            <InfoItem
              icon={<CalendarPlusIcon size={18} />}
              label={t('gameInfo.created')}
              value={formatDate(game.created_at)}
              compact={compact}
            />
          </motion.div>
        )}
        {game.translation_updated_at && (
          <motion.div layout transition={{ duration: 0.2 }}>
            <InfoItem
              icon={<CalendarClockIcon size={18} />}
              label={t('gameInfo.updated')}
              value={formatDate(game.translation_updated_at)}
              compact={compact}
            />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
