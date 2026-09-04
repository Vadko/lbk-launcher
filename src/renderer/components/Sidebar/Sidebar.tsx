import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import type { TagOption } from '@/shared/types';
import { useDebounce } from '../../hooks/useDebounce';
import { useFilterCounts } from '../../hooks/useFilterCounts';
import { useGames } from '../../hooks/useGames';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useStore } from '../../store/useStore';
import { useSubscriptionsStore } from '../../store/useSubscriptionsStore';
import type { Game } from '../../types/game';
import { deriveGroupNaming } from '../../utils/groupName';
import { GlassPanel } from '../Layout/GlassPanel';
import { TranslationPickerModal } from '../Modal/TranslationPickerModal';
import { AuthorsFilterDropdown } from './AuthorsFilterDropdown';
import { GameList } from './GameList';
import { HorizontalGameList } from './HorizontalGameList';
import { SearchBar } from './SearchBar';
import { SidebarFooter } from './SidebarFooter';
import { SidebarHeader } from './SidebarHeader';
import { StatusFilterDropdown } from './StatusFilterDropdown';
import { TagsFilterDropdown } from './TagsFilterDropdown';
import type { GameGroup } from './types';

const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 500;
const FILTERS_RELOAD_DEBOUNCE = 300;

interface SidebarProps {
  onOpenHistory: () => void;
  isHorizontal?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(
  ({ onOpenHistory, isHorizontal = false }) => {
    const navigate = useNavigate();

    // Use shallow selectors to prevent unnecessary re-renders
    // Статуси, автори, спеціальний (бібліотечний) фільтр і типи контенту - незалежні
    // групи, що комбінуються через AND, тож вибір в одній групі не скидає інші.
    const {
      selectedGame,
      selectedStatuses,
      searchQuery,
      setSelectedStatuses,
      setSearchQuery,
      gamesWithUpdates,
      isGameDetected,
    } = useStore(
      useShallow((state) => ({
        selectedGame: state.selectedGame,
        selectedStatuses: state.selectedStatuses,
        searchQuery: state.searchQuery,
        setSelectedStatuses: state.setSelectedStatuses,
        setSearchQuery: state.setSearchQuery,
        gamesWithUpdates: state.gamesWithUpdates,
        isGameDetected: state.isGameDetected,
      }))
    );
    const {
      openSettingsModal,
      sidebarWidth,
      setSidebarWidth,
      specialFilter,
      setSpecialFilter,
      selectedContentTypes,
      setSelectedContentTypes,
      selectedAuthors,
      setSelectedAuthors,
      selectedTagIds,
      setSelectedTagIds,
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
        selectedContentTypes: state.selectedContentTypes,
        setSelectedContentTypes: state.setSelectedContentTypes,
        selectedAuthors: state.selectedAuthors,
        setSelectedAuthors: state.setSelectedAuthors,
        selectedTagIds: state.selectedTagIds,
        setSelectedTagIds: state.setSelectedTagIds,
        sortOrder: state.sortOrder,
        setSortOrder: state.setSortOrder,
        hideAiTranslations: state.hideAiTranslations,
        animationsEnabled: state.animationsEnabled,
      }))
    );
    const unreadCount = useSubscriptionsStore((state) => state.unreadCount);

    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // Translation picker modal state. Bundled so opening/closing is atomic and
    // we never flash translations from one group with variants from another.
    type PickerPayload = {
      translations: Game[];
      gameName: string;
      variantById: Map<string, string>;
    };
    const [pickerPayload, setPickerPayload] = useState<PickerPayload | null>(null);

    const openTranslationPicker = useCallback(
      (translations: Game[], gameName: string, variantById: Map<string, string>) => {
        setPickerPayload({ translations, gameName, variantById });
      },
      []
    );
    const closeTranslationPicker = useCallback(() => setPickerPayload(null), []);

    // Fetch authors and tag options (wait for sync to complete)
    const syncStatus = useStore((state) => state.syncStatus);
    const [authors, setAuthors] = useState<string[]>([]);
    const [authorsLoading, setAuthorsLoading] = useState(true);
    const [tags, setTags] = useState<TagOption[]>([]);
    const [tagsLoading, setTagsLoading] = useState(true);
    const reloadFiltersTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadAuthors = useCallback(async () => {
      try {
        const fetchedAuthors = await window.electronAPI.fetchTeams();
        setAuthors(fetchedAuthors);
      } catch (error) {
        console.error('[Sidebar] Error fetching authors:', error);
      } finally {
        setAuthorsLoading(false);
      }
    }, []);

    const loadTags = useCallback(async () => {
      try {
        const fetchedTags = await window.electronAPI.fetchTagOptions();
        setTags(fetchedTags);
      } catch (error) {
        console.error('[Sidebar] Error fetching tags:', error);
      } finally {
        setTagsLoading(false);
      }
    }, []);

    useEffect(() => {
      if (syncStatus !== 'ready' && syncStatus !== 'error') {
        return;
      }
      loadAuthors();
      loadTags();

      // Пачка бродкастів при масовому апдейті каталогу інакше дала б N
      // синхронних сканів games у main-процесі поспіль
      const unsub = window.electronAPI?.onGameUpdated?.(() => {
        if (reloadFiltersTimerRef.current) {
          clearTimeout(reloadFiltersTimerRef.current);
        }
        reloadFiltersTimerRef.current = setTimeout(() => {
          loadAuthors();
          loadTags();
        }, FILTERS_RELOAD_DEBOUNCE);
      });
      return () => {
        unsub?.();
        if (reloadFiltersTimerRef.current) {
          clearTimeout(reloadFiltersTimerRef.current);
        }
      };
    }, [syncStatus, loadAuthors, loadTags]);

    const {
      games: visibleGames,
      total: totalGames,
      isLoading,
    } = useGames({
      selectedStatuses,
      selectedAuthors,
      selectedTagIds,
      specialFilter,
      selectedContentTypes,
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

    // Group games by steam_app_id first; fallback to slug/id (games already sorted by SQL)
    const gameGroups = useMemo((): GameGroup[] => {
      const groupMap = new Map<string, GameGroup>();

      const getGroupKey = (game: Game): string => {
        if (game.steam_app_id !== null && game.steam_app_id !== undefined) {
          return `steam:${game.steam_app_id}`;
        }
        return game.slug ? `slug:${game.slug}` : `id:${game.id}`;
      };

      for (const game of visibleGames) {
        const key = getGroupKey(game);
        const existing = groupMap.get(key);

        if (existing) {
          existing.translations.push(game);
          continue;
        }

        groupMap.set(key, {
          key,
          name: game.name,
          translations: [game],
          variantById: new Map(),
        });
      }

      const groups = Array.from(groupMap.values());

      for (const group of groups) {
        group.translations.sort(
          (a, b) => (b.translation_progress ?? 0) - (a.translation_progress ?? 0)
        );
        // Derive a clean shared title and per-translation variant suffix
        // (e.g. "Stray (без озвучення)" → name="Stray", variant="(без озвучення)").
        const naming = deriveGroupNaming(group.translations);
        group.name = naming.name;
        group.variantById = naming.variantById;
      }

      // Preserve group order from SQL (first appearance of each key)
      return groups;
    }, [visibleGames]);

    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

    const listRef = useRef<HTMLDivElement>(null);
    const stripRef = useRef<HTMLDivElement>(null);

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
      if (!isResizing) {
        return;
      }

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

    const toggleGroupExpanded = useCallback((key: string) => {
      setExpandedGroups((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(key)) {
          newSet.delete(key);
        } else {
          newSet.add(key);
        }
        return newSet;
      });
    }, []);

    const handleSelectGame = useCallback(
      (game: Game) => navigate(`/game/${game.id}`),
      [navigate]
    );

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
                selectedContentTypes={selectedContentTypes}
                onContentTypesChange={setSelectedContentTypes}
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
            <div className="flex-1 min-w-0 max-w-[220px]" data-gamepad-header-item>
              <TagsFilterDropdown
                selectedTagIds={selectedTagIds}
                onTagsChange={setSelectedTagIds}
                tags={tags}
                isLoading={tagsLoading}
                wideMenu
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
            ref={stripRef}
            data-gamepad-game-list
            data-gamepad-total={gameGroups.length}
            className="px-4 py-3 overflow-x-auto custom-scrollbar"
          >
            <HorizontalGameList
              gameGroups={gameGroups}
              totalGames={totalGames}
              isLoading={isLoading}
              scrollRef={stripRef}
              animationsEnabled={animationsEnabled}
              selectedGameId={selectedGame?.id}
              gamesWithUpdates={gamesWithUpdates}
              onSelectGame={handleSelectGame}
              onOpenTranslationPicker={openTranslationPicker}
              isGameDetected={isGameDetected}
            />
          </div>

          {/* Translation picker modal */}
          <TranslationPickerModal
            isOpen={pickerPayload !== null}
            onClose={closeTranslationPicker}
            translations={pickerPayload?.translations ?? []}
            gameName={pickerPayload?.gameName ?? ''}
            variantById={pickerPayload?.variantById}
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
            selectedContentTypes={selectedContentTypes}
            onContentTypesChange={setSelectedContentTypes}
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

        <div className="flex gap-2 px-4 pb-4">
          <TagsFilterDropdown
            selectedTagIds={selectedTagIds}
            onTagsChange={setSelectedTagIds}
            tags={tags}
            isLoading={tagsLoading}
          />
        </div>

        <div
          ref={listRef}
          className="flex-1 overflow-y-auto pl-4 pr-2 mr-2 pt-0 custom-scrollbar relative"
        >
          <GameList
            gameGroups={gameGroups}
            totalGames={totalGames}
            isLoading={isLoading}
            scrollRef={listRef}
            animationsEnabled={animationsEnabled}
            expandedGroups={expandedGroups}
            selectedGameId={selectedGame?.id}
            gamesWithUpdates={gamesWithUpdates}
            onToggleGroup={toggleGroupExpanded}
            onSelectGame={handleSelectGame}
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
