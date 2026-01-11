import React, { useEffect } from 'react';
import type { Game } from '@renderer/types/game';
import { useGames } from '@/renderer/hooks/useGames';
import { GameListItem } from '../Sidebar/GameListItem';
import { useStore } from '@/renderer/store/useStore';

interface GamesSectionProps {
  title: string;
  showLimit?: number;
  showDownloadCounter?: boolean;
}

export const GamesSection: React.FC<GamesSectionProps> = ({
  title,
  showLimit = 3,
  showDownloadCounter = false,
}) => {
  const { setSelectedGame } = useStore();
  const { games, isLoading } = useGames({});
  const [visibleGames, setVisibleGames] = React.useState<Game[]>([]);

  useEffect(() => {
    setVisibleGames(games.slice(0, showLimit));
  }, [games, showLimit]);

  return (
    <div className="text-left w-full max-w-[1317px]">
      <h2 className="text-4xl font-head font-semibold text-text-main mb-8">{title}</h2>
      <div className={`grid grid-cols-3 gap-8`}>
        {isLoading ? (
          <p>Завантаження... </p>
        ) : visibleGames.length === 0 && !isLoading ? (
          <p className="text-text-muted">Ігор не знайдено.</p>
        ) : (
          visibleGames.map((game) => (
            <GameListItem
              key={game.id}
              game={game}
              isSelected={false}
              isCardStyle={true}
              showDownloadCounter={showDownloadCounter}
              onClick={() => setSelectedGame(game)}
            />
          ))
        )}
      </div>
    </div>
  );
};
