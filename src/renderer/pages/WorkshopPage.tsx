import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { WorkshopGameCard } from '../components/MainContent/WorkshopGameCard';
import { SearchBar } from '../components/Sidebar/SearchBar';
import { Loader } from '../components/ui/Loader';
import { useDebounce } from '../hooks/useDebounce';
import { useWorkshopGames } from '../hooks/useWorkshopGames';
import { useStore } from '../store/useStore';
import { trackEvent } from '../utils/analytics';
import { openSteamWorkshopItem } from '../utils/steamProtocol';

const INITIAL_VISIBLE_COUNT = 30;
const LOAD_MORE_CHUNK = 30;

export const WorkshopPage: React.FC = () => {
  const setSelectedGame = useStore((state) => state.setSelectedGame);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const { games, isLoading, error } = useWorkshopGames(debouncedSearchQuery);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedGame(null);
  }, [setSelectedGame]);

  useEffect(() => {
    trackEvent('Workshop Page Open');
  }, []);

  // Скинути видимий зріз при зміні пошукового запиту (adjust state під час
  // рендеру, а не в ефекті - уникає зайвого циклу рендерів).
  const [prevSearchQuery, setPrevSearchQuery] = useState(debouncedSearchQuery);
  if (prevSearchQuery !== debouncedSearchQuery) {
    setPrevSearchQuery(debouncedSearchQuery);
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  }

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((count) => Math.min(count + LOAD_MORE_CHUNK, games.length));
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [games.length]);

  const visibleGames = useMemo(() => games.slice(0, visibleCount), [games, visibleCount]);

  const handleOpenWorkshopItem = (workshopId: string) => {
    openSteamWorkshopItem(workshopId);
  };

  return (
    <div
      data-gamepad-main-content
      className="flex-1 grid grid-cols-1 justify-items-center items-start px-8 overflow-y-auto justify-center custom-scrollbar"
    >
      <div className="main-page grid grid-rows-auto grid-cols-1 gap-8 h-auto w-full max-w-[1317px]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-4xl font-head font-semibold text-text-main">
            Steam Workshop
          </h2>
          <div className="w-full max-w-sm">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {isLoading && games.length === 0 ? (
              <motion.div
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="col-span-3 flex items-center justify-center py-12"
              >
                <Loader size="md" />
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="col-span-3 text-center text-text-muted py-8"
              >
                <p>Не вдалося завантажити переклади Steam Workshop</p>
              </motion.div>
            ) : visibleGames.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="col-span-3 text-center text-text-muted py-8"
              >
                <p>Перекладів не знайдено</p>
              </motion.div>
            ) : (
              visibleGames.map((game, index) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: Math.min((index % LOAD_MORE_CHUNK) * 0.03, 0.5),
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                >
                  <WorkshopGameCard
                    game={game}
                    onClick={() => handleOpenWorkshopItem(game.workshop_id)}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {visibleCount < games.length && <div ref={sentinelRef} className="h-1" />}
      </div>
    </div>
  );
};
