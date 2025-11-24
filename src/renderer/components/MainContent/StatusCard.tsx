import React from 'react';
import { Game } from '../../types/game';
import { ProgressBar } from './ProgressBar';

interface StatusCardProps {
  game: Game;
}

export const StatusCard: React.FC<StatusCardProps> = ({ game }) => {
  return (
    <div className="glass-card">
      <h3 className="text-lg font-head font-semibold text-white mb-4">
        Прогрес перекладу
      </h3>
      <div>
        <ProgressBar
          label="Переклад"
          value={game.progress.translation}
          color="#00f2ff"
        />
        <ProgressBar
          label="Редагування"
          value={game.progress.editing}
          color="#bd00ff"
        />
        <ProgressBar
          label="Озвучення"
          value={game.progress.voicing}
          color="#ff0055"
        />
      </div>
    </div>
  );
};
