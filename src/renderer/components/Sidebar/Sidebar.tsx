import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { Settings, User, MessageCircle } from 'lucide-react';
import { GlassPanel } from '../Layout/GlassPanel';
import { SearchBar } from './SearchBar';
import { GameListItem } from './GameListItem';
import { Loader } from '../ui/Loader';
import { useStore } from '../../store/useStore';
import { useModalStore } from '../../store/useModalStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useGamesInfiniteQuery } from '../../hooks/useGamesQuery';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import logo from '../../../../resources/icon.png';
import type { Database } from '../../../lib/database.types';

type FilterType = 'all' | Database['public']['Enums']['game_status'] | 'installed-games';

export const Sidebar: React.FC = React.memo(() => {
  const {
    selectedGame,
    filter,
    searchQuery,
    setSelectedGame,
    setFilter,
    setSearchQuery,
    gamesWithUpdates,
    isGameDetected,
    loadInstalledGames,
  } = useStore();
  const { showModal } = useModalStore();
  const { openSettingsModal } = useSettingsStore();

  const itemsPerPage = 10;

  // React Query для отримання ігор
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useGamesInfiniteQuery({
    filter,
    searchQuery,
    itemsPerPage,
  });

  // Flatten всі сторінки в один масив
  const visibleGames = useMemo(
    () => data?.pages.flatMap((page) => page.games) ?? [],
    [data]
  );

  const totalGames = useMemo(
    () => data?.pages[0]?.total ?? 0,
    [data]
  );

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Infinite scroll для завантаження наступної сторінки
  const observerTarget = useInfiniteScroll({
    onLoadMore: () => { fetchNextPage(); },
    hasMore: hasNextPage ?? false,
    isLoading: isFetchingNextPage,
  });

  // Завантажити metadata про встановлені переклади для нових ігор
  const processedGamesRef = useRef<Set<string>>(new Set());
  const lastFilterRef = useRef({ filter, searchQuery });

  useEffect(() => {
    // Очистити список оброблених ігор при зміні фільтра або пошуку
    if (lastFilterRef.current.filter !== filter || lastFilterRef.current.searchQuery !== searchQuery) {
      processedGamesRef.current.clear();
      lastFilterRef.current = { filter, searchQuery };
    }
  }, [filter, searchQuery]);

  useEffect(() => {
    if (visibleGames.length === 0) return;

    // Знайти тільки нові ігри, які ще не перевірені
    const newGames = visibleGames.filter(game => !processedGamesRef.current.has(game.id));

    if (newGames.length === 0) return;

    // Додати нові ігри до списку оброблених
    newGames.forEach(game => processedGamesRef.current.add(game.id));

    // Завантажити metadata про встановлені переклади тільки для нових ігор
    loadInstalledGames(newGames);

    // NOTE: detectInstalledGames викликається в App.tsx один раз на початку + при зміні Steam бібліотеки
    // Тут його викликати не потрібно, щоб не створювати зайве навантаження
  }, [visibleGames, loadInstalledGames, filter, searchQuery]);

  const handleSearchChange = (value: string) => {
    // Update search query immediately for input
    setSearchQuery(value);

    // Debounce the actual refetch
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      refetch();
    }, 300);
  };

  const filters = useMemo<{ label: string; value: FilterType }[]>(() => [
    { label: 'Усі', value: 'all' },
    { label: 'Заплановано', value: 'planned' },
    { label: 'Ранній доступ', value: 'in-progress' },
    { label: 'Готово', value: 'completed' },
    { label: 'Встановлені', value: 'installed-games' },
  ], []);

  const handleOpenTelegram = useCallback(() => {
    window.electronAPI?.openExternal('https://t.me/lb_launcher_bot');
  }, []);

  const handleShowAbout = useCallback(() => {
    showModal({
      title: 'Про додаток',
      message: `LB Launcher v${window.electronAPI?.getVersion?.() || '1.0.0'}\n\nІнсталятор українських перекладів відеоігор\n\n💙 Дякуємо за підтримку!`,
      type: 'info',
    });
  }, [showModal]);

  return (
    <GlassPanel className="w-[280px] h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b p-4 border-border select-none">
        <img
          src={logo}
          alt="LB logo"
          className="w-12 h-12"
          draggable={false}
        />
        <div>
          <h1 className="text-lg font-head font-bold text-white">LB</h1>
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
            {visibleGames.map((game, index) => (
              <React.Fragment key={game.id}>
                <GameListItem
                  game={game}
                  isSelected={selectedGame?.id === game.id}
                  onClick={() => setSelectedGame(game)}
                  hasUpdate={gamesWithUpdates.has(game.id)}
                  isGameDetected={isGameDetected(game.id)}
                />
                {/* Sentinel за 5 елементів до кінця для раннього завантаження */}
                {hasNextPage && index === visibleGames.length - 5 && (
                  <div ref={observerTarget} className="h-0" />
                )}
              </React.Fragment>
            ))}
            {/* Loader в кінці списку */}
            {isFetchingNextPage && (
              <div className="py-4 flex items-center justify-center">
                <Loader size="sm" />
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
          onClick={handleOpenTelegram}
          className="flex-1 p-3 glass-button rounded-xl hover:bg-glass-hover transition-all duration-300"
          title="Зворотній зв'язок"
        >
          <MessageCircle size={20} className="mx-auto text-text-muted" />
        </button>
        <button
          onClick={handleShowAbout}
          className="flex-1 p-3 glass-button rounded-xl hover:bg-glass-hover transition-all duration-300"
          title="Профіль"
        >
          <User size={20} className="mx-auto text-text-muted" />
        </button>
      </div>
    </GlassPanel>
  );
});
