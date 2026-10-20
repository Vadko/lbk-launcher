import React from 'react';
import { t } from '@/shared/i18n/i18n';
import type { Game } from '../../../shared/types';
import { ProgressBar } from './ProgressBar';

interface StatusCardProps {
  game: Game;
}

export const StatusCard: React.FC<StatusCardProps> = ({ game }) => (
  <div className="glass-card-no-motion">
    <h3 className="text-lg font-head font-semibold text-text-main mb-4">
      {t('translationStatusCard.title')}
    </h3>
    <div>
      <ProgressBar
        label={t('translationProgress.translation')}
        value={game.translation_progress}
        color="#A2D2F6"
      />
      <ProgressBar
        label={t('translationProgress.editing')}
        value={game.editing_progress}
        color="#FFD7A1"
      />
      {game.fonts_progress != null && game.fonts_progress > 0 && (
        <ProgressBar
          label={t('translationProgress.fonts')}
          value={game.fonts_progress}
          color="#FDA0B2"
        />
      )}
      {game.textures_progress != null && (
        <ProgressBar
          label={t('translationProgress.textures')}
          value={game.textures_progress}
          color="#BDFC9F"
        />
      )}
      {game.voice_progress != null && (
        <ProgressBar
          label={t('translationProgress.voice')}
          value={game.voice_progress}
          color="#06b6d4"
        />
      )}
    </div>
  </div>
);
