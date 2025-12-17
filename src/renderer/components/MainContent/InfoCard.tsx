import React from 'react';
import { Game } from '../../types/game';
import {
  Gamepad2,
  Calendar,
  CalendarPlus,
  CalendarClock,
  Users,
  HardDrive,
  Download,
  Volume2,
  Trophy,
} from 'lucide-react';

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
    <div className="text-neon-blue mt-0.5">{icon}</div>
    <div>
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className="text-sm text-white font-medium">{value}</div>
    </div>
  </div>
);

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const InfoCard: React.FC<InfoCardProps> = ({ game }) => {
  const platformsText = game.platforms.join(', ').toUpperCase();
  const downloadsText = game.downloads?.toLocaleString('uk-UA') || '0';
  const isPlanned = game.status === 'planned';

  return (
    <div className="glass-card">
      <h3 className="text-lg font-head font-semibold text-white mb-4">Інформація</h3>
      <div className="grid grid-cols-2 gap-4">
        <InfoItem icon={<Gamepad2 size={18} />} label="Платформи" value={platformsText} />
        {game.version && (
          <InfoItem icon={<Calendar size={18} />} label="Версія" value={game.version} />
        )}
        {game.team && (
          <InfoItem icon={<Users size={18} />} label="Команда" value={game.team} />
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
            label="Озвучка"
            value={game.voice_archive_size}
          />
        )}
        {game.achievements_archive_size && (
          <InfoItem
            icon={<Trophy size={18} />}
            label="Досягнення"
            value={game.achievements_archive_size}
          />
        )}
        {!isPlanned && (
          <InfoItem
            icon={<Download size={18} />}
            label="Завантажень"
            value={downloadsText}
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
