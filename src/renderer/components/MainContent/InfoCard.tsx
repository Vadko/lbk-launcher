import React from 'react';
import { Game } from '../../types/game';
import { Gamepad2, Calendar, Users } from 'lucide-react';

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

export const InfoCard: React.FC<InfoCardProps> = ({ game }) => {
  const platformsText = game.platforms.join(', ').toUpperCase();

  return (
    <div className="glass-card">
      <h3 className="text-lg font-head font-semibold text-white mb-4">
        Інформація
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <InfoItem
          icon={<Gamepad2 size={18} />}
          label="Платформи"
          value={platformsText}
        />
        <InfoItem
          icon={<Calendar size={18} />}
          label="Версія"
          value={game.version || 'N/A'}
        />
        <InfoItem icon={<Users size={18} />} label="Команда" value={game.team} />
      </div>
    </div>
  );
};
