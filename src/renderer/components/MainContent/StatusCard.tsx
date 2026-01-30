import React from 'react';
import type { Game } from '../../types/game';
import { ProgressBar } from './ProgressBar';

interface StatusCardProps {
  game: Game;
}

export const StatusCard: React.FC<StatusCardProps> = ({ game }) => (
  <div className="glass-card">
    <h3 className="text-lg font-head font-semibold text-text-main mb-4">
      Прогрес перекладу
    </h3>
    <div>
      <ProgressBar label="Переклад" value={game.translation_progress} color="#A2D2F6" />
      <ProgressBar label="Редактура" value={game.editing_progress} color="#FFD7A1" />
      {game.fonts_progress && (
        <ProgressBar label="Шрифти" value={game.fonts_progress} color="#FDA0B2" />
      )}
      {game.textures_progress && (
        <ProgressBar label="Текстури" value={game.textures_progress} color="#BDFC9F" />
      )}
      {game.voice_progress && (
        <ProgressBar label="Озвучення" value={game.voice_progress} color="#06b6d4" />
      )}
    </div>
  </div>
);
