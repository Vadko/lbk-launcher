import {
  Award,
  Bell,
  Bot,
  Calendar,
  CalendarClock,
  CalendarPlus,
  Download,
  Gamepad2,
  HardDrive,
  Trophy,
  Volume2,
} from 'lucide-react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
    <div className={`flex gap-1 ${compact ? 'items-center' : 'flex-col'}`}>
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
  });
};

export const InfoCard: React.FC<InfoCardProps> = ({ game }) => {
  const platformsText = game.platforms.map(getReadablePlatform).join(', ');
  const isPlanned = game.status === 'planned';
  const hasDownloads = !!game.downloads && game.downloads > 0;
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
          {(game.ai === 'edited' || game.ai === 'non-edited') && (
            <Tooltip
              content={
                game.ai === 'edited'
                  ? 'Переклад зроблено за допомогою ШІ та відредаговано людиною'
                  : 'Переклад зроблено за допомогою ШІ без редагування'
              }
              align="left"
            >
              <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-500/20 rounded text-purple-400 text-xs cursor-help">
                <Bot size={12} />
                <span>{game.ai === 'edited' ? 'ШІ (ред.)' : 'ШІ'}</span>
              </div>
            </Tooltip>
          )}
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
      <div className={`grid ${compact ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-4'}`}>
        <InfoItem
          icon={<Gamepad2 size={18} />}
          label="Платформи"
          value={platformsText}
          compact={compact}
        />
        {game.version && (
          <InfoItem
            icon={<Calendar size={18} />}
            label="Версія"
            value={game.version}
            compact={compact}
          />
        )}
        {game.archive_size && (
          <InfoItem
            icon={<HardDrive size={18} />}
            label="Розмір"
            value={game.archive_size}
            compact={compact}
          />
        )}
        {game.voice_archive_size && (
          <InfoItem
            icon={<Volume2 size={18} />}
            label="Озвучення"
            value={game.voice_archive_size}
            compact={compact}
          />
        )}
        {game.achievements_archive_size && (
          <div className="flex items-start gap-3">
            <div className="text-neon-blue mt-0.5">
              <Trophy size={18} />
            </div>
            <div className={`flex gap-1 ${compact ? 'items-center' : 'flex-col'}`}>
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
        )}
        {isPlanned && hasSubscriptions && (
          <InfoItem
            icon={<Bell size={18} />}
            label="Підписників"
            value={game.subscriptions!.toLocaleString('uk-UA')}
            compact={compact}
          />
        )}
        {!isPlanned && hasDownloads && (
          <InfoItem
            icon={<Download size={18} />}
            label="Завантажень"
            value={game.downloads!.toLocaleString('uk-UA')}
            compact={compact}
          />
        )}
        {game.created_at && (
          <InfoItem
            icon={<CalendarPlus size={18} />}
            label="Створено"
            value={formatDate(game.created_at)}
            compact={compact}
          />
        )}
        {game.updated_at && (
          <InfoItem
            icon={<CalendarClock size={18} />}
            label="Оновлено"
            value={formatDate(game.updated_at)}
            compact={compact}
          />
        )}
      </div>
    </div>
  );
};
