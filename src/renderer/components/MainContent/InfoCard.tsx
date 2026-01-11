import React from 'react';
import type { Game } from '../../types/game';
import {
  Gamepad2,
  Calendar,
  CalendarPlus,
  CalendarClock,
  HardDrive,
  Download,
  Volume2,
  Trophy,
  Bell,
  Award,
} from 'lucide-react';
import { getFeaturedInfo } from '../../constants/featuredTranslations';
import { Tooltip } from '../ui/Tooltip';

interface InfoCardProps {
  game: Game;
}

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const InfoItem: React.FC<InfoItemProps> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="text-color-main mt-0.5">{icon}</div>
    <div>
      <div className="text-xs text-text-muted mb-1">{label}</div>
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
  const platformsText = game.platforms.join(', ').toUpperCase();
  const isPlanned = game.status === 'planned';
  const hasDownloads = !!game.downloads && game.downloads > 0;
  const hasSubscriptions = !!game.subscriptions && game.subscriptions > 0;
  const featuredInfo = getFeaturedInfo(game.slug, game.team);

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-head font-semibold text-text-main">Інформація</h3>
        {featuredInfo && (
          <Tooltip content={featuredInfo.description} align="left">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 rounded text-amber-400 text-xs cursor-help">
              <Award size={12} />
              <span>Відзнака</span>
            </div>
          </Tooltip>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InfoItem icon={<Gamepad2 size={18} />} label="Платформи" value={platformsText} />
        {game.version && (
          <InfoItem icon={<Calendar size={18} />} label="Версія" value={game.version} />
        )}
        {game.archive_size && (
          <InfoItem
            icon={<HardDrive size={18} />}
            label="Розмір"
            value={game.archive_size}
          />
        )}
        {game.voice_archive_size && (
          <InfoItem
            icon={<Volume2 size={18} />}
            label="Озвучення"
            value={game.voice_archive_size}
          />
        )}
        {game.achievements_archive_size && (
          <div className="flex items-start gap-3">
            <div className="text-neon-blue mt-0.5">
              <Trophy size={18} />
            </div>
            <div>
              <div className="text-xs text-text-muted mb-1">Досягнення</div>
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
          />
        )}
        {!isPlanned && hasDownloads && (
          <InfoItem
            icon={<Download size={18} />}
            label="Завантажень"
            value={game.downloads!.toLocaleString('uk-UA')}
          />
        )}
        {game.created_at && (
          <InfoItem
            icon={<CalendarPlus size={18} />}
            label="Створено"
            value={formatDate(game.created_at)}
          />
        )}
        {game.updated_at && (
          <InfoItem
            icon={<CalendarClock size={18} />}
            label="Оновлено"
            value={formatDate(game.updated_at)}
          />
        )}
      </div>
    </div>
  );
};
