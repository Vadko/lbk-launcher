import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { getGameGroupKey } from '@/shared/game-filters';
import { compareTranslationRank } from '@/shared/translation-rating';
import type { Game, TagOption } from '@/shared/types';
import { useDebounce } from '../../hooks/useDebounce';
import { useFacetData } from '../../hooks/useFacetData';
import { useGames } from '../../hooks/useGames';
import { useResource } from '../../hooks/useResource';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useStore } from '../../store/useStore';
import { useSubscriptionsStore } from '../../store/useSubscriptionsStore';
import { deriveGroupNaming } from '../../utils/groupName';
import { showOnlyAuthors } from '../../utils/showOnlyAuthors';
import { GlassPanel } from '../Layout/GlassPanel';
import { TranslationPickerModal } from '../Modal/TranslationPickerModal';
import { FilterBar } from './FilterBar';
import { FiltersModal } from './FiltersModal/FiltersModal';
import { GameList } from './GameList';
import { HorizontalGameList } from './HorizontalGameList';
import { SearchBar } from './SearchBar';
import { SidebarFooter } from './SidebarFooter';
import { SidebarHeader } from './SidebarHeader';
import type { GameGroup } from './types';

const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 500;
const NO_AUTHORS: string[] = [];
const NO_TAGS: TagOption[] = [];

interface SidebarProps {
  onOpenHistory: () => void;
  isHorizontal?: boolean;
}

export function Sidebar({ onOpenHistory, isHorizontal = false }: SidebarProps) {
  const navigate = useNavigate();

  // Use shallow selectors to prevent unnecessary re-renders
  // Statuses, authors, the special (library) filter and content types are
  // independent groups combined via AND, so a selection in one group doesn't reset others.
  const {
    selectedGame,
    selectedStatuses,
    searchQuery,
    setSelectedStatuses,
    setSearchQuery,
    gamesWithUpdates,
  } = useStore(
    useShallow((state) => ({
      selectedGame: state.selectedGame,
      selectedStatuses: state.selectedStatuses,
      searchQuery: state.searchQuery,
      setSelectedStatuses: state.setSelectedStatuses,
      setSearchQuery: state.setSearchQuery,
      gamesWithUpdates: state.gamesWithUpdates,
    }))
  );
  const detectedGames = useStore((state) => state.detectedGames);
  const isGameDetected = (gameId: string) => detectedGames.has(gameId);
  const {
    openSettingsModal,
    sidebarWidth,
    setSidebarWidth,
    specialFilter,
    setSpecialFilter,
    selectedContentTypes,
    setSelectedContentTypes,
    selectedTranslationTypes,
    setSelectedTranslationTypes,
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
      selectedTranslationTypes: state.selectedTranslationTypes,
      setSelectedTranslationTypes: state.setSelectedTranslationTypes,
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

  const openTranslationPicker = (
    translations: Game[],
    gameName: string,
    variantById: Map<string, string>
  ) => {
    setPickerPayload({ translations, gameName, variantById });
  };
  const closeTranslationPicker = () => setPickerPayload(null);

  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);

  // Quick-filter values are surfaced as their own toggle buttons on the panel
  // (with their own active highlight), so they're excluded from the "Фільтри"
  // button's count - only modal-only filters count toward it.
  const isQuickSpecialFilter =
    specialFilter === 'installed-translations' ||
    specialFilter === 'favorite-translations';
  const modalFilterCount =
    selectedStatuses.length +
    selectedContentTypes.length +
    selectedTranslationTypes.length +
    selectedAuthors.length +
    selectedTagIds.length +
    (specialFilter && !isQuickSpecialFilter ? 1 : 0);

  const handleClearAllFilters = () => showOnlyAuthors([]);

  const handleToggleInstalledQuick = () => {
    setSpecialFilter(
      specialFilter === 'installed-translations' ? null : 'installed-translations'
    );
  };

  const handleToggleFavoriteQuick = () => {
    setSpecialFilter(
      specialFilter === 'favorite-translations' ? null : 'favorite-translations'
    );
  };

  const catalogOptions = useResource('catalogOptions');
  const authors = catalogOptions.value?.teams ?? NO_AUTHORS;
  const tags = catalogOptions.value?.tags ?? NO_TAGS;
  const optionsLoading = catalogOptions.status === 'loading';

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
    selectedTranslationTypes,
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
  const groupMap = new Map<string, GameGroup>();

  for (const game of visibleGames) {
    const key = getGameGroupKey(game);
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

  // Preserve group order from SQL (first appearance of each key)
  const gameGroups = Array.from(groupMap.values());

  for (const group of gameGroups) {
    group.translations.sort(compareTranslationRank);
    // Derive a clean shared title and per-translation variant suffix
    // (e.g. "Stray (no voice acting)" → name="Stray", variant="(no voice acting)").
    const naming = deriveGroupNaming(group.translations);
    group.name = naming.name;
    group.variantById = naming.variantById;
  }

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  const listRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(sidebarWidth);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = sidebarWidth;
  };

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

  const toggleGroupExpanded = (key: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleSelectGame = (game: Game) => navigate(`/game/${game.id}`);

  const facetData = useFacetData(isFiltersModalOpen);

  if (isHorizontal) {
    // Horizontal gamepad mode
    // Disable backdrop-blur when animations are off for performance
    const headerClass = animationsEnabled
      ? 'w-full flex flex-col backdrop-blur-md'
      : 'w-full flex flex-col';

    return (
      <div className={headerClass}>
        {/* Header bar */}
        <div
          data-gamepad-header
          className="flex items-center gap-4 px-4 py-2 border-b border-white/5"
        >
          <SidebarHeader isCompact />

          {/* Search */}
          <div className="flex-1 min-w-0" data-gamepad-header-item data-gamepad-search>
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>

          {/* Filters */}
          <FilterBar
            isHorizontal
            activeFilterCount={modalFilterCount}
            onOpenFilters={() => setIsFiltersModalOpen(true)}
            onClearAll={handleClearAllFilters}
            isInstalledQuickActive={specialFilter === 'installed-translations'}
            onToggleInstalledQuick={handleToggleInstalledQuick}
            isFavoriteQuickActive={specialFilter === 'favorite-translations'}
            onToggleFavoriteQuick={handleToggleFavoriteQuick}
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
          />

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

        <FiltersModal
          isOpen={isFiltersModalOpen}
          onClose={() => setIsFiltersModalOpen(false)}
          selectedStatuses={selectedStatuses}
          onStatusesChange={setSelectedStatuses}
          selectedContentTypes={selectedContentTypes}
          onContentTypesChange={setSelectedContentTypes}
          selectedTranslationTypes={selectedTranslationTypes}
          onTranslationTypesChange={setSelectedTranslationTypes}
          hideAiTranslations={hideAiTranslations}
          specialFilter={specialFilter}
          onSpecialFilterChange={setSpecialFilter}
          selectedAuthors={selectedAuthors}
          onAuthorsChange={setSelectedAuthors}
          authors={authors}
          authorsLoading={optionsLoading}
          selectedTagIds={selectedTagIds}
          onTagsChange={setSelectedTagIds}
          tags={tags}
          tagsLoading={optionsLoading}
          facetData={facetData}
          searchQuery={debouncedSearchQuery}
        />
      </div>
    );
  }

  // Vertical layout (default)
  return (
    <GlassPanel
      className="h-full flex flex-col relative z-10"
      style={{ width: sidebarWidth }}
    >
      <SidebarHeader />

      <div className="p-4">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* Filters row */}
      <div className="px-4 pb-4">
        <FilterBar
          activeFilterCount={modalFilterCount}
          onOpenFilters={() => setIsFiltersModalOpen(true)}
          onClearAll={handleClearAllFilters}
          isInstalledQuickActive={specialFilter === 'installed-translations'}
          onToggleInstalledQuick={handleToggleInstalledQuick}
          isFavoriteQuickActive={specialFilter === 'favorite-translations'}
          onToggleFavoriteQuick={handleToggleFavoriteQuick}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
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

      <FiltersModal
        isOpen={isFiltersModalOpen}
        onClose={() => setIsFiltersModalOpen(false)}
        selectedStatuses={selectedStatuses}
        onStatusesChange={setSelectedStatuses}
        selectedContentTypes={selectedContentTypes}
        onContentTypesChange={setSelectedContentTypes}
        selectedTranslationTypes={selectedTranslationTypes}
        onTranslationTypesChange={setSelectedTranslationTypes}
        hideAiTranslations={hideAiTranslations}
        specialFilter={specialFilter}
        onSpecialFilterChange={setSpecialFilter}
        selectedAuthors={selectedAuthors}
        onAuthorsChange={setSelectedAuthors}
        authors={authors}
        authorsLoading={optionsLoading}
        selectedTagIds={selectedTagIds}
        onTagsChange={setSelectedTagIds}
        tags={tags}
        tagsLoading={optionsLoading}
        facetData={facetData}
        searchQuery={debouncedSearchQuery}
      />
    </GlassPanel>
  );
}
