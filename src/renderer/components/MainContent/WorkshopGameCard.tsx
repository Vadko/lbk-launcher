import { ExternalLink } from 'lucide-react';
import React, { useState } from 'react';
import type { WorkshopGame } from '@/shared/types';
import { openSteamStorePage } from '../../utils/steamProtocol';
import { Button } from '../ui/Button';
import { Loader } from '../ui/Loader';

interface WorkshopGameCardProps {
  game: WorkshopGame;
  onClick: () => void;
}

/**
 * thumbnail_url - повний URL на images.steamusercontent.com, а не відносний
 * storage path (як capsule_path/thumbnail_path у games), тож кеш-бастинг через
 * updated_at не потрібен - хеш у самому URL вже унікальний для контенту.
 * Параметри - вбудована ресайз-функція Steam CDN (letterbox-кроп до квадрата).
 */
function getWorkshopThumbnailUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }
  return `${url}?imw=268&imh=268&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=true`;
}

/**
 * Картка Steam Workshop перекладу. Візуально відповідає card-режиму
 * GameListItem (зображення + назва + автор), але без прогресу/статусу/
 * лічильника завантажень/AI-бейджа - ця інформація для Workshop-перекладів
 * не збирається.
 */
export const WorkshopGameCard: React.FC<WorkshopGameCardProps> = ({ game, onClick }) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageErrored, setImageErrored] = useState(false);

  const thumbnailUrl = getWorkshopThumbnailUrl(game.thumbnail_url);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const handleOpenSteamStorePage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (game.steam_app_id != null) {
      openSteamStorePage(game.steam_app_id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="group glass-card !p-0 flex flex-col items-center scroll-m-20"
    >
      <div className="relative aspect-[616/353] w-full bg-glass rounded-t-xl overflow-hidden">
        {thumbnailUrl && !imageErrored ? (
          <>
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-glass">
                <Loader size="sm" />
              </div>
            )}
            <img
              src={thumbnailUrl}
              alt={game.game_name}
              draggable={false}
              decoding="async"
              className={`w-full h-full object-cover transition-[opacity, scale] duration-300 group-hover:scale-[1.05] ${
                imageLoading ? 'opacity-0' : 'opacity-100'
              }`}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageErrored(true);
                setImageLoading(false);
              }}
            />
          </>
        ) : (
          <div
            className="w-full h-full bg-gradient-to-br from-color-main to-color-accent flex items-center justify-center text-text-dark font-bold text-2xl truncate"
            title={game.game_name}
          >
            {game.game_name.charAt(0)}
          </div>
        )}
      </div>
      <div className="flex-grow p-4 gap-2 flex flex-col w-full text-sm text-text-main">
        <div className="flex items-center gap-2">
          <h3
            className="text-lg font-head font-bold truncate flex-1"
            title={game.game_name}
          >
            {game.game_name}
          </h3>
          {game.steam_app_id != null && (
            <Button
              variant="ghost"
              onClick={handleOpenSteamStorePage}
              className="!rounded-lg !px-1"
              icon={
                <ExternalLink
                  size={20}
                  className="text-text-muted group-hover/button:text-text-main"
                />
              }
              title="Відкрити сторінку гри в Steam"
            />
          )}
        </div>
        {game.name && (
          <p className="text-text-muted text-xs truncate -mt-1" title={game.name}>
            {game.name}
          </p>
        )}
        <div className="p-3 bg-glass-hover rounded-xl mt-auto">
          <h4 className="font-semibold truncate" title={game.team ?? undefined}>
            {game.team || 'Невідомий автор'}
          </h4>
        </div>
      </div>
    </div>
  );
};
