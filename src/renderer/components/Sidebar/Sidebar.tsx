import React, { useEffect, useRef, useCallback } from 'react';
import { Settings, User, MessageCircle } from 'lucide-react';
import { GlassPanel } from '../Layout/GlassPanel';
import { SearchBar } from './SearchBar';
import { GameListItem } from './GameListItem';
import { Loader } from '../ui/Loader';
import { useStore, useVisibleGames } from '../../store/useStore';
import { useModalStore } from '../../store/useModalStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import logo from '../../../../resources/icon.png';

type FilterType = 'all' | 'in-progress' | 'completed' | 'early-access' | 'funded';

export const Sidebar: React.FC = () => {
  const {
    selectedGame,
    filter,
    searchQuery,
    setSelectedGame,
    setFilter,
    setSearchQuery,
    gamesWithUpdates,
    loadMoreGames,
    fetchGames,
  } = useStore();
  const { games: visibleGames, totalGames, hasMore, isLoading, isLoadingMore } = useVisibleGames();
  const { showModal } = useModalStore();
  const { openSettingsModal } = useSettingsStore();

  const observerTarget = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = (value: string) => {
    // Update search query immediately for input
    setSearchQuery(value);

    // Debounce the actual fetch
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchGames();
    }, 300);
  };

  const handleLoadMore = useCallback(() => {
    if (hasMore) {
      loadMoreGames();
    }
  }, [hasMore, loadMoreGames]);

  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, handleLoadMore]);

  const filters: { label: string; value: FilterType }[] = [
    { label: 'Усі', value: 'all' },
    { label: 'В процесі', value: 'in-progress' },
    { label: 'Готово', value: 'completed' },
    { label: 'Ранній доступ', value: 'early-access' },
  ];

  return (
    <GlassPanel className="w-[280px] h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b p-4 border-border select-none">
        <img
          src={logo}
          alt="Little Bit logo"
          className="w-12 h-12"
          draggable={false}
        />
        <div>
          <h1 className="text-lg font-head font-bold text-white">Little Bit</h1>
          <p className="text-xs text-text-muted">Українські переклади</p>
        </div>
      </div>

      {/* Search */}
      <div className="p-4">
        <SearchBar value={searchQuery} onChange={handleSearchChange} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 p-4 pt-0">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${
              filter === f.value
                ? 'bg-glass-hover text-white border border-border-hover'
                : 'bg-glass text-text-muted border border-transparent hover:bg-glass-hover hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Games list */}
      <div className="flex-1 overflow-y-auto space-y-2 p-4 pt-0 custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader size="md" />
          </div>
        ) : totalGames === 0 ? (
          <div className="text-center text-text-muted py-8">
            <p>Ігор не знайдено</p>
          </div>
        ) : (
          <>
            {visibleGames.map((game) => (
              <GameListItem
                key={game.id}
                game={game}
                isSelected={selectedGame?.id === game.id}
                onClick={() => setSelectedGame(game)}
                hasUpdate={gamesWithUpdates.has(game.id)}
              />
            ))}
            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={observerTarget} className="py-4 flex items-center justify-center">
                {isLoadingMore ? <Loader size="sm" /> : <div className="h-4" />}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-2 pt-3 border-t border-border p-4">
        <button
          onClick={openSettingsModal}
          className="flex-1 p-3 glass-button rounded-xl hover:bg-glass-hover transition-all duration-300"
          title="Налаштування"
        >
          <Settings size={20} className="mx-auto text-text-muted" />
        </button>
        <button
          onClick={() => {
            window.electronAPI?.openExternal('https://t.me/lb_launcher_bot');
          }}
          className="flex-1 p-3 glass-button rounded-xl hover:bg-glass-hover transition-all duration-300"
          title="Зворотній зв'язок"
        >
          <MessageCircle size={20} className="mx-auto text-text-muted" />
        </button>
        <button
          onClick={() => {
            showModal({
              title: 'Про додаток',
              message: `Little Bit v${window.electronAPI?.getVersion?.() || '1.0.0'}\n\nІнсталятор українських перекладів відеоігор\n\n💙 Дякуємо за підтримку!`,
              type: 'info',
            });
          }}
          className="flex-1 p-3 glass-button rounded-xl hover:bg-glass-hover transition-all duration-300"
          title="Профіль"
        >
          <User size={20} className="mx-auto text-text-muted" />
        </button>
      </div>
    </GlassPanel>
  );
};
