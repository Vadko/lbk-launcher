import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDebounce } from '../../hooks/useDebounce';
import { useFilterCounts } from '../../hooks/useFilterCounts';
import { useGames } from '../../hooks/useGames';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useStore } from '../../store/useStore';
import { useSubscriptionsStore } from '../../store/useSubscriptionsStore';
import type { Game } from '../../types/game';
import { GlassPanel } from '../Layout/GlassPanel';
import { TranslationPickerModal } from '../Modal/TranslationPickerModal';
import { AuthorsFilterDropdown } from './AuthorsFilterDropdown';
import { GameList } from './GameList';
import { HorizontalGameList } from './HorizontalGameList';
import { SearchBar } from './SearchBar';
import { SidebarFooter } from './SidebarFooter';
import { SidebarHeader } from './SidebarHeader';
import { StatusFilterDropdown } from './StatusFilterDropdown';
import type { GameGroup } from './types';

const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 500;

interface SidebarProps {
  onOpenHistory: () => void;
  isHorizontal?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(
  ({ onOpenHistory, isHorizontal = false }) => {
    // Use shallow selectors to prevent unnecessary re-renders
    const {
      selectedGame,
      selectedStatuses,
      searchQuery,
      setSelectedGame,
      setSelectedStatuses: setSelectedStatusesRaw,
      setSearchQuery,
      gamesWithUpdates,
      isGameDetected,
      loadInstalledGamesFromSystem,
    } = useStore(
      useShallow((state) => ({
        selectedGame: state.selectedGame,
        selectedStatuses: state.selectedStatuses,
        searchQuery: state.searchQuery,
        setSelectedGame: state.setSelectedGame,
        setSelectedStatuses: state.setSelectedStatuses,
        setSearchQuery: state.setSearchQuery,
        gamesWithUpdates: state.gamesWithUpdates,
        isGameDetected: state.isGameDetected,
        loadInstalledGamesFromSystem: state.loadInstalledGamesFromSystem,
      }))
    );
    const {
      openSettingsModal,
      sidebarWidth,
      setSidebarWidth,
      specialFilter,
      setSpecialFilter: setSpecialFilterRaw,
      selectedAuthors,
      setSelectedAuthors,
      sortOrder,
      setSortOrder,
      hideAiTranslations,
      animationsEnabled,
    } = useSettingsStore(
      useShallow((state) => ({
        openSettingsModal: state.openSettingsModal,
        sidebarWidth: state.sidebarWidth,
        setSidebarWidth: state.setSidebarWidth,
        specialFilter: state.specialFilter,
        setSpecialFilter: state.setSpecialFilter,
        selectedAuthors: state.selectedAuthors,
        setSelectedAuthors: state.setSelectedAuthors,
        sortOrder: state.sortOrder,
        setSortOrder: state.setSortOrder,
        hideAiTranslations: state.hideAiTranslations,
        animationsEnabled: state.animationsEnabled,
      }))
    );
    const unreadCount = useSubscriptionsStore((state) => state.unreadCount);

    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    const setSelectedStatuses = useCallback(
      (statuses: string[]) => {
        setSpecialFilterRaw(null);
        setSelectedStatusesRaw(statuses);
      },
      [setSpecialFilterRaw, setSelectedStatusesRaw]
    );

    const setSpecialFilter = useCallback(
      (filter: typeof specialFilter) => {
        if (filter !== null) {
          setSelectedStatusesRaw([]);
          setSelectedAuthors([]);
        }
        setSpecialFilterRaw(filter);
      },
      [setSpecialFilterRaw, setSelectedStatusesRaw, setSelectedAuthors]
    );

    // Translation picker modal state
    const [pickerModalOpen, setPickerModalOpen] = useState(false);
    const [pickerTranslations, setPickerTranslations] = useState<Game[]>([]);
    const [pickerGameName, setPickerGameName] = useState('');

    const openTranslationPicker = (translations: Game[], gameName: string) => {
      setPickerTranslations(translations);
      setPickerGameName(gameName);
      setPickerModalOpen(true);
    };

    // Fetch authors list
    const [authors, setAuthors] = useState<string[]>([]);
    const [authorsLoading, setAuthorsLoading] = useState(true);

    useEffect(() => {
      const loadAuthors = async () => {
        try {
          const fetchedAuthors = await window.electronAPI.fetchTeams();
          setAuthors(fetchedAuthors);
        } catch (error) {
          console.error('[Sidebar] Error fetching authors:', error);
        } finally {
          setAuthorsLoading(false);
        }
      };
      loadAuthors();
    }, []);

    const {
      games: visibleGames,
      total: totalGames,
      isLoading,
    } = useGames({
      selectedStatuses,
      selectedAuthors,
      specialFilter,
      searchQuery: debouncedSearchQuery,
      sortOrder,
      hideAiTranslations,
    });

    // Track failed searches (0 results)
    const lastTrackedFailedSearch = useRef('');
    useEffect(() => {
      if (
        debouncedSearchQuery &&
        debouncedSearchQuery.trim().length >= 2 &&
        !isLoading &&
        totalGames === 0 &&
        lastTrackedFailedSearch.current !== debouncedSearchQuery
      ) {
        lastTrackedFailedSearch.current = debouncedSearchQuery;
        window.electronAPI.trackFailedSearch(debouncedSearchQuery);
      }
    }, [debouncedSearchQuery, isLoading, totalGames]);

    // Group games by slug (games already sorted by SQL)
    const gameGroups = useMemo((): GameGroup[] => {
      const groupMap = new Map<string, GameGroup>();

      for (const game of visibleGames) {
        const slug = game.slug || game.id;
        const existing = groupMap.get(slug);
        if (existing) {
          existing.translations.push(game);
        } else {
          groupMap.set(slug, {
            slug,
            name: game.name,
            translations: [game],
          });
        }
      }

      // Sort translations within each group by progress
      for (const group of groupMap.values()) {
        group.translations.sort(
          (a, b) => (b.translation_progress ?? 0) - (a.translation_progress ?? 0)
        );
      }

      // Preserve order from SQL (already sorted)
      return Array.from(groupMap.values());
    }, [visibleGames]);

    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const listRef = useRef<HTMLDivElement>(null);

    // Resize state
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartX = useRef(0);
    const resizeStartWidth = useRef(sidebarWidth);

    const handleResizeStart = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        resizeStartX.current = e.clientX;
        resizeStartWidth.current = sidebarWidth;
      },
      [sidebarWidth]
    );

    useEffect(() => {
      if (!isResizing) return;

      // Set cursor on body to maintain it when mouse leaves the handle
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - resizeStartX.current;
        const newWidth = Math.min(
          MAX_SIDEBAR_WIDTH,
          Math.max(MIN_SIDEBAR_WIDTH, resizeStartWidth.current + delta)
        );
        setSidebarWidth(newWidth);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }, [isResizing, setSidebarWidth]);

    const toggleGroupExpanded = (slug: string) => {
      setExpandedGroups((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(slug)) {
          newSet.delete(slug);
        } else {
          newSet.add(slug);
        }
        return newSet;
      });
    };

    const hasLoadedRef = useRef(false);

    useEffect(() => {
      if (hasLoadedRef.current) return;
      hasLoadedRef.current = true;

      const timer = setTimeout(() => {
        loadInstalledGamesFromSystem();
      }, 500);

      return () => clearTimeout(timer);
    }, [loadInstalledGamesFromSystem]);

    // Filter counts from dedicated hook (with debouncing)
    const { counts: filterCounts } = useFilterCounts();

    if (isHorizontal) {
      // Horizontal gamepad mode
      // Disable backdrop-blur when animations are off for performance
      const headerClass = animationsEnabled
        ? 'w-full flex flex-col bg-glass/30 backdrop-blur-md'
        : 'w-full flex flex-col bg-bg-dark/90';

      return (
        <div className={headerClass}>
          {/* Header bar */}
          <div
            data-gamepad-header
            className="flex items-center gap-4 px-4 py-2 border-b border-white/5"
          >
            <SidebarHeader isCompact />

            {/* Search */}
            <div className="flex-1 min-w-0" data-gamepad-header-item>
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
            </div>

            {/* Filters */}
            <div className="flex-1 min-w-0 max-w-[200px]" data-gamepad-header-item>
              <StatusFilterDropdown
                selectedStatuses={selectedStatuses}
                onStatusesChange={setSelectedStatuses}
                specialFilter={specialFilter}
                onSpecialFilterChange={setSpecialFilter}
                counts={filterCounts}
                sortOrder={sortOrder}
                onSortChange={setSortOrder}
              />
            </div>
            <div className="flex-1 min-w-0 max-w-[220px]" data-gamepad-header-item>
              <AuthorsFilterDropdown
                selectedAuthors={selectedAuthors}
                onAuthorsChange={setSelectedAuthors}
                authors={authors}
                isLoading={authorsLoading}
              />
            </div>

            {/* Actions */}
            <SidebarFooter
              onOpenHistory={onOpenHistory}
              onOpenSettings={openSettingsModal}
              unreadCount={unreadCount}
              isCompact={true}
            />
          </div>

          {/* Games strip */}
          <div
            data-gamepad-game-list
            className="px-4 py-3 overflow-x-auto custom-scrollbar"
          >
            <HorizontalGameList
              gameGroups={gameGroups}
              totalGames={totalGames}
              isLoading={isLoading}
              animationsEnabled={animationsEnabled}
              selectedGameId={selectedGame?.id}
              gamesWithUpdates={gamesWithUpdates}
              onSelectGame={setSelectedGame}
              onOpenTranslationPicker={openTranslationPicker}
              isGameDetected={isGameDetected}
            />
          </div>

          {/* Translation picker modal */}
          <TranslationPickerModal
            isOpen={pickerModalOpen}
            onClose={() => setPickerModalOpen(false)}
            translations={pickerTranslations}
            gameName={pickerGameName}
          />
        </div>
      );
    }

    // Vertical layout (default)
    return (
      <GlassPanel
        className="h-full flex flex-col relative"
        style={{ width: sidebarWidth }}
      >
        <SidebarHeader />

        <div className="p-4">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Filters row */}
        <div className="flex gap-2 px-4 pb-4">
          <StatusFilterDropdown
            selectedStatuses={selectedStatuses}
            onStatusesChange={setSelectedStatuses}
            specialFilter={specialFilter}
            onSpecialFilterChange={setSpecialFilter}
            counts={filterCounts}
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
          />
          <AuthorsFilterDropdown
            selectedAuthors={selectedAuthors}
            onAuthorsChange={setSelectedAuthors}
            authors={authors}
            isLoading={authorsLoading}
          />
        </div>

        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-4 pt-0 custom-scrollbar relative"
        >
          <GameList
            gameGroups={gameGroups}
            totalGames={totalGames}
            isLoading={isLoading}
            animationsEnabled={animationsEnabled}
            expandedGroups={expandedGroups}
            selectedGameId={selectedGame?.id}
            gamesWithUpdates={gamesWithUpdates}
            onToggleGroup={toggleGroupExpanded}
            onSelectGame={setSelectedGame}
            isGameDetected={isGameDetected}
          />
        </div>

        <SidebarFooter
          onOpenHistory={onOpenHistory}
          onOpenSettings={openSettingsModal}
          unreadCount={unreadCount}
        />

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize group hover:bg-primary/50 transition-colors z-50 ${isResizing ? 'bg-primary/50' : 'bg-transparent'}`}
          onMouseDown={handleResizeStart}
        >
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1 h-12 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </GlassPanel>
    );
  }
);
