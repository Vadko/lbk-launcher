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
        <ProgressBar label="Переклад" value={game.translation_progress} color="#00f2ff" />
        <ProgressBar label="Редагування" value={game.editing_progress} color="#bd00ff" />
        {game.fonts_progress !== null && game.fonts_progress !== undefined && (
          <ProgressBar label="Шрифти" value={game.fonts_progress} color="#ff6b35" />
        )}
        {game.textures_progress !== null && game.textures_progress !== undefined && (
          <ProgressBar label="Текстури" value={game.textures_progress} color="#4ecdc4" />
        )}
        {game.voice_progress !== null && game.voice_progress !== undefined && (
          <ProgressBar label="Озвучка" value={game.voice_progress} color="#ffd93d" />
        )}
      </div>
    </div>
  );
};
