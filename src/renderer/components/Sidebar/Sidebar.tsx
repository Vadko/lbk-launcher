import React, { useEffect, useRef, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, ListFilter, Check, Bell } from 'lucide-react';
import { GlassPanel } from '../Layout/GlassPanel';
import { SearchBar } from './SearchBar';
import { GameListItem } from './GameListItem';
import { Loader } from '../ui/Loader';
import { useStore } from '../../store/useStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useSubscriptionsStore } from '../../store/useSubscriptionsStore';
import { useGames } from '../../hooks/useGames';
import { useDebounce } from '../../hooks/useDebounce';
import logo from '../../../../resources/icon.png';
import type { Database } from '../../../lib/database.types';

type FilterType =
  | 'all'
  | Database['public']['Enums']['game_status']
  | 'installed-translations'
  | 'installed-games';

interface SidebarProps {
  onOpenHistory: () => void;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({ onOpenHistory }) => {
  const {
    selectedGame,
    filter,
    searchQuery,
    setSelectedGame,
    setFilter,
    setSearchQuery,
    gamesWithUpdates,
    isGameDetected,
    loadInstalledGamesFromSystem,
  } = useStore();
  const { openSettingsModal } = useSettingsStore();
  const unreadCount = useSubscriptionsStore((state) => state.unreadCount);

  // Debounce search query - 300ms delay
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Локальна база даних через IPC (завантажуємо всі ігри одразу)
  const {
    games: visibleGames,
    total: totalGames,
    isLoading,
  } = useGames({
    filter,
    searchQuery: debouncedSearchQuery,
  });

  console.log(
    '[Sidebar] Render with games:',
    visibleGames.length,
    'filter:',
    filter,
    'search:',
    debouncedSearchQuery
  );

  const hasLoadedRef = useRef(false);

  // Новий підхід: один раз перевіряємо всі встановлені ігри на системі
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    // Відкладаємо сканування на 500мс для швидшого старту додатка
    const timer = setTimeout(() => {
      // Викликаємо reverse підхід: сканування системи → matching з БД → перевірка
      loadInstalledGamesFromSystem();
    }, 500);

    return () => clearTimeout(timer);
  }, [loadInstalledGamesFromSystem]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  const allFilters = useMemo<{ label: string; value: FilterType; group?: string }[]>(
    () => [
      { label: 'Усі ігри', value: 'all' },
      { label: 'Заплановано', value: 'planned' },
      { label: 'Ранній доступ', value: 'in-progress' },
      { label: 'Готово', value: 'completed' },
      {
        label: 'Встановлені українізатори',
        value: 'installed-translations',
        group: 'installed',
      },
      { label: 'Встановлені ігри', value: 'installed-games', group: 'installed' },
    ],
    []
  );

  const currentFilterLabel = useMemo(() => {
    return allFilters.find((f) => f.value === filter)?.label || 'Усі ігри';
  }, [filter, allFilters]);

  // Закрити меню при кліку поза ним
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(event.target as Node)
      ) {
        setIsFilterMenuOpen(false);
      }
    };

    if (isFilterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterMenuOpen]);

  return (
    <GlassPanel className="w-[320px] h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b p-4 border-border select-none">
        <img src={logo} alt="LB logo" className="w-12 h-12" draggable={false} />
        <div>
          <h1 className="text-lg font-head font-bold text-white">LB</h1>
          <p className="text-xs text-text-muted">Українізатори ігор</p>
        </div>
      </div>

      {/* Search */}
      <div className="p-4">
        <SearchBar value={searchQuery} onChange={handleSearchChange} />
      </div>

      {/* Filter Dropdown */}
      <div className="relative px-4 pb-4" ref={filterMenuRef}>
        <button
          onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
            filter !== 'all'
              ? 'bg-glass-hover text-white border border-border-hover'
              : 'bg-glass text-text-muted border border-transparent hover:bg-glass-hover hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <ListFilter size={14} />
            {currentFilterLabel}
          </span>
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isFilterMenuOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        <AnimatePresence>
          {isFilterMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-4 right-4 -mt-2 py-1 bg-bg-dark border border-border rounded-lg shadow-xl z-50 overflow-hidden filter-dropdown"
            >
              {allFilters.map((f, index) => (
                <React.Fragment key={f.value}>
                  {f.group === 'installed' &&
                    index > 0 &&
                    allFilters[index - 1]?.group !== 'installed' && (
                      <div className="border-t border-border my-1" />
                    )}
                  <button
                    onClick={() => {
                      setFilter(f.value);
                      setIsFilterMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                      filter === f.value
                        ? 'bg-glass-hover text-white'
                        : 'text-text-muted hover:bg-glass hover:text-white'
                    }`}
                  >
                    {f.label}
                    {filter === f.value && <Check size={14} />}
                  </button>
                </React.Fragment>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Games list */}
      <div className="flex-1 overflow-y-auto p-4 pt-0 custom-scrollbar">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="flex items-center justify-center py-12"
            >
              <Loader size="md" />
            </motion.div>
          ) : totalGames === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="text-center text-text-muted py-8"
            >
              <p>Ігор не знайдено</p>
            </motion.div>
          ) : (
            <motion.div
              key={`games-${filter}-${debouncedSearchQuery}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="space-y-2"
            >
              {visibleGames.map((game, index) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: Math.min(index * 0.03, 0.5),
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                >
                  <GameListItem
                    game={game}
                    isSelected={selectedGame?.id === game.id}
                    onClick={() => setSelectedGame(game)}
                    hasUpdate={gamesWithUpdates.has(game.id)}
                    isGameDetected={isGameDetected(game.id)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex gap-2 pt-3 border-t border-border p-4">
        <button
          onClick={onOpenHistory}
          className="relative flex-1 p-3 glass-button rounded-xl hover:bg-glass-hover transition-all duration-300"
          title="Сповіщення"
        >
          <Bell size={20} className="mx-auto text-text-muted" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] px-1 h-4 bg-neon-blue text-bg-dark text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={openSettingsModal}
          className="flex-1 p-3 glass-button rounded-xl hover:bg-glass-hover transition-all duration-300"
          title="Налаштування"
        >
          <Settings size={20} className="mx-auto text-text-muted" />
        </button>
      </div>
    </GlassPanel>
  );
});
