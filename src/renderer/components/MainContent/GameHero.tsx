import React from 'react';
import { Game } from '../../types/game';
import { getGameImageUrl } from '../../utils/imageUrl';

interface GameHeroProps {
  game: Game;
}

export const GameHero: React.FC<GameHeroProps> = ({ game }) => {
  const bannerUrl = getGameImageUrl(game.banner_path);
  const logoUrl = getGameImageUrl(game.logo_path);

  return (
    <div className="relative h-[300px] rounded-2xl overflow-hidden mb-6 select-none">
      {/* Background image */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          backgroundClip: 'content-box',
          padding: 1,
        }}
      >
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt={game.name}
            className="w-full h-full rounded-2xl object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neon-purple via-neon-blue to-neon-pink" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/50 to-transparent" />
      </div>

      {/* Game logo */}
      <div className="relative h-full flex items-end p-8">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={game.name}
            className="max-h-32 max-w-md object-contain drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]"
            draggable={false}
          />
        ) : (
          <h1 className="text-5xl font-head font-bold text-white drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
            {game.name}
          </h1>
        )}
      </div>
    </div>
  );
};
