import { motion } from 'framer-motion';
import {
  Award,
  Bell,
  Calendar,
  CalendarClock,
  CalendarPlus,
  Download,
  Gamepad2,
  HardDrive,
  Trophy,
  Volume2,
} from 'lucide-react';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { getReadablePlatform } from '@/renderer/helpers/getReadablePlatform.ts';
import { getFeaturedInfo } from '../../constants/featuredTranslations';
import type { Game } from '../../types/game';
import { Tooltip } from '../ui/Tooltip';

interface InfoCardProps {
  game: Game;
}

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  compact?: boolean;
}

const InfoItem: React.FC<InfoItemProps> = ({ icon, label, value, compact }) => (
  <div className="flex items-start gap-3">
    <div className="text-color-main mt-0.5">{icon}</div>
    <div
      className={`flex gap-1 transition-all duration-200 ${compact ? 'items-center flex-row' : 'flex-col'}`}
    >
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-sm font-medium text-text-main">{value}</div>
    </div>
  </div>
);

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
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
    <div ref={cardRef} className="glass-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-head font-semibold text-text-main">Інформація</h3>
        <div className="flex items-center gap-2">
          {featuredInfo && (
            <Tooltip content={featuredInfo.description} align="left">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 rounded text-amber-400 text-xs cursor-help">
                <Award size={12} />
                <span>Відзнака</span>
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
            icon={<Gamepad2 size={18} />}
            label="Платформи"
            value={platformsText}
            compact={compact}
          />
        </motion.div>
        {game.version && (
          <motion.div layout transition={{ duration: 0.2 }}>
            <InfoItem
              icon={<Calendar size={18} />}
              label="Версія"
              value={game.version}
              compact={compact}
            />
          </motion.div>
        )}
        {game.archive_size && (
          <motion.div layout transition={{ duration: 0.2 }}>
            <InfoItem
              icon={<HardDrive size={18} />}
              label="Розмір"
              value={game.archive_size}
              compact={compact}
            />
          </motion.div>
        )}
        {game.voice_archive_size && (
          <motion.div layout transition={{ duration: 0.2 }}>
            <InfoItem
              icon={<Volume2 size={18} />}
              label="Озвучення"
              value={game.voice_archive_size}
              compact={compact}
            />
          </motion.div>
        )}
        {game.achievements_archive_size && (
          <motion.div layout transition={{ duration: 0.2 }}>
            <div className="flex items-start gap-3">
              <div className="text-neon-blue mt-0.5">
                <Trophy size={18} />
              </div>
              <div
                className={`flex gap-1 transition-all duration-200 ${compact ? 'items-center flex-row' : 'flex-col'}`}
              >
                <div className="text-xs text-text-muted">Досягнення</div>
                <div className="text-sm font-medium text-text-main">
                  {game.achievements_archive_size}
                </div>
                {game.achievements_third_party && (
                  <div className="text-xs text-text-muted mt-0.5">
                    від {game.achievements_third_party}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
        {isPlanned && hasSubscriptions && (
          <motion.div layout transition={{ duration: 0.2 }}>
            <InfoItem
              icon={<Bell size={18} />}
              label="Підписників"
              value={game.subscriptions!.toLocaleString('uk-UA')}
              compact={compact}
            />
          </motion.div>
        )}
        {!isPlanned && (
          <motion.div layout transition={{ duration: 0.2 }}>
            <InfoItem
              icon={<Download size={18} />}
              label="Завантажень"
              value={
                !game.downloads || game.downloads < 20
                  ? 'до 20'
                  : game.downloads!.toLocaleString('uk-UA')
              }
              compact={compact}
            />
          </motion.div>
        )}
        {game.created_at && (
          <motion.div layout transition={{ duration: 0.2 }}>
            <InfoItem
              icon={<CalendarPlus size={18} />}
              label="Створено"
              value={formatDate(game.created_at)}
              compact={compact}
            />
          </motion.div>
        )}
        {game.translation_updated_at && (
          <motion.div layout transition={{ duration: 0.2 }}>
            <InfoItem
              icon={<CalendarClock size={18} />}
              label="Оновлено"
              value={formatDate(game.translation_updated_at)}
              compact={compact}
            />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
