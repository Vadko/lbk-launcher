import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '../Layout/GlassPanel';
import { SearchBar } from './SearchBar';
import { GameListItem } from './GameListItem';
import { StatusFilterDropdown } from './StatusFilterDropdown';
import { AuthorsFilterDropdown } from './AuthorsFilterDropdown';
import { SidebarHeader } from './SidebarHeader';
import { SidebarFooter } from './SidebarFooter';
import { AlphabetSidebar } from './AlphabetSidebar';
import { GameGroupItem } from './GameGroupItem';
import { GamepadCard } from './GamepadCard';
import { Loader } from '../ui/Loader';
import { TranslationPickerModal } from '../Modal/TranslationPickerModal';
import { useStore } from '../../store/useStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useSubscriptionsStore } from '../../store/useSubscriptionsStore';
import { useGames } from '../../hooks/useGames';
import { useDebounce } from '../../hooks/useDebounce';
import type { GameGroup } from './types';
import type { Game } from '../../types/game';

const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 500;

interface SidebarProps {
  onOpenHistory: () => void;
  isHorizontal?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({
  onOpenHistory,
  isHorizontal = false,
}) => {
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
  } = useStore();
  const {
    openSettingsModal,
    sidebarWidth,
    setSidebarWidth,
    specialFilter,
    setSpecialFilter: setSpecialFilterRaw,
    selectedAuthors,
    setSelectedAuthors,
  } = useSettingsStore();
  const unreadCount = useSubscriptionsStore((state) => state.unreadCount);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const setSelectedStatuses = useCallback((statuses: string[]) => {
    setSpecialFilterRaw(null);
    setSelectedStatusesRaw(statuses);
  }, [setSpecialFilterRaw, setSelectedStatusesRaw]);

  const setSpecialFilter = useCallback((filter: typeof specialFilter) => {
    if (filter !== null) {
      setSelectedStatusesRaw([]);
      setSelectedAuthors([]);
    }
    setSpecialFilterRaw(filter);
  }, [setSpecialFilterRaw, setSelectedStatusesRaw, setSelectedAuthors]);

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
  });

  // Group games by slug
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

    for (const group of groupMap.values()) {
      group.translations.sort(
        (a, b) => (b.translation_progress ?? 0) - (a.translation_progress ?? 0)
      );
    }

    return Array.from(groupMap.values());
  }, [visibleGames]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Alphabet Sidebar logic
  const listRef = useRef<HTMLDivElement>(null);

  const sortedAlphabet = useMemo(() => {
    const letters = new Set<string>();

    gameGroups.forEach((group) => {
      const firstChar = group.name.charAt(0).toUpperCase();
      if (/[A-ZА-ЯҐЄІЇ]/.test(firstChar)) {
        letters.add(firstChar);
      } else {
        letters.add('#');
      }
    });

    return Array.from(letters).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;

      const isALatin = /[A-Z]/.test(a);
      const isBLatin = /[A-Z]/.test(b);

      if (isALatin && !isBLatin) return -1;
      if (!isALatin && isBLatin) return 1;

      return a.localeCompare(b);
    });
  }, [gameGroups]);

  // Scroll Sync Logic
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const activeLetterTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (activeLetterTimeoutRef.current) {
        clearTimeout(activeLetterTimeoutRef.current);
      }
    };
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    const scrollHeight = container.scrollHeight;

    // Clear existing timeout to keep highlight active while scrolling
    if (activeLetterTimeoutRef.current) {
      clearTimeout(activeLetterTimeoutRef.current);
    }

    let foundLetter: string | null = null;

    // 1. Check if we are at the very bottom
    // If so, highlight the last letter regardless of where it starts
    if (Math.abs(scrollHeight - clientHeight - scrollTop) < 50) {
      const lastGroup = gameGroups[gameGroups.length - 1];
      if (lastGroup) {
        const firstChar = lastGroup.name.charAt(0).toUpperCase();
        foundLetter = /[A-ZА-ЯҐЄІЇ]/.test(firstChar) ? firstChar : '#';
      }
    } else {
      // 2. Standard Spy Logic with "Top" Trigger
      // Reverted to top tracking per user request.
      // We add a small buffer (50px) so the switch happens just as the element enters the top area.
      const triggerLine = scrollTop + 50;

      let activeGroup = null;

      for (const group of gameGroups) {
        const element = document.getElementById(`group-${group.slug}`);
        if (!element) continue;

        // If the group has started (offsetTop < triggerLine), it's a candidate.
        if (element.offsetTop <= triggerLine) {
          activeGroup = group;
        } else {
          // Since groups are ordered, once we cross the trigger line, stop.
          break;
        }
      }

      if (activeGroup) {
        const firstChar = activeGroup.name.charAt(0).toUpperCase();
        foundLetter = /[A-ZА-ЯҐЄІЇ]/.test(firstChar) ? firstChar : '#';
      }
    }

    if (foundLetter) {
      setActiveLetter(foundLetter);

      // Hide highlight after 1 second of no scrolling
      activeLetterTimeoutRef.current = setTimeout(() => {
        setActiveLetter(null);
      }, 1000);
    }
  }, [gameGroups]);

  const smoothScrollTo = (target: number, duration: number) => {
    const container = listRef.current;
    if (!container) return;

    const start = container.scrollTop;
    const distance = target - start;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);

      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      container.scrollTop = start + (distance * ease);

      if (timeElapsed < duration) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };

  const handleLetterClick = useCallback((letter: string) => {
    const targetGroup = gameGroups.find((g) => {
      const firstChar = g.name.charAt(0).toUpperCase();
      return letter === '#'
        ? !/[A-ZА-ЯҐЄІЇ]/.test(firstChar)
        : firstChar === letter;
    });

    if (targetGroup) {
      const element = document.getElementById(`group-${targetGroup.slug}`);
      if (element && listRef.current) {
        // Calculate target scroll position
        const targetTop = element.offsetTop;
        smoothScrollTo(targetTop, 200); // 300ms fast smooth scroll
      }
    }
  }, [gameGroups]);


  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(sidebarWidth);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = sidebarWidth;
  }, [sidebarWidth]);

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

  if (isHorizontal) {
    // Horizontal gamepad mode
    return (
      <div className="w-full flex flex-col bg-glass/30 backdrop-blur-md">
        {/* Header bar */}
        <div data-gamepad-header className="flex items-center gap-4 px-4 py-2 border-b border-white/5">
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
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader size="md" />
            </div>
          ) : totalGames === 0 ? (
            <div className="flex items-center justify-center h-32 text-text-muted">
              <p>Ігор не знайдено</p>
            </div>
          ) : (
            <div className="flex gap-3">
              {gameGroups.map((group) => {
                const primaryGame = group.translations[0];
                const isSelected = group.translations.some(
                  (t) => selectedGame?.id === t.id
                );
                const hasUpdate = group.translations.some((t) =>
                  gamesWithUpdates.has(t.id)
                );
                const detected = group.translations.some((t) =>
                  isGameDetected(t.id)
                );

                const handleClick = () => {
                  if (group.translations.length > 1) {
                    openTranslationPicker(group.translations, group.name);
                  } else {
                    setSelectedGame(primaryGame);
                  }
                };

                return (
                  <GamepadCard
                    key={group.slug}
                    game={primaryGame}
                    translations={group.translations}
                    translationIndex={0}
                    isSelected={isSelected}
                    hasUpdate={hasUpdate}
                    isDetected={detected}
                    onClick={handleClick}
                  />
                );
              })}
            </div>
          )}
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
        />
        <AuthorsFilterDropdown
          selectedAuthors={selectedAuthors}
          onAuthorsChange={setSelectedAuthors}
          authors={authors}
          isLoading={authorsLoading}
        />
      </div>

      {/* Games list with Alphabet Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 pt-0 custom-scrollbar relative"
        >
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
                key={`games-${specialFilter}-${selectedStatuses.join(',')}-${selectedAuthors.join(',')}-${debouncedSearchQuery}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="space-y-2 relative"
              >
                {gameGroups.map((group, index) => {
                  const hasMultipleTranslations = group.translations.length > 1;
                  const primaryGame = group.translations[0];

                  return (
                    <motion.div
                      key={group.slug}
                      id={`group-${group.slug}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.4,
                        delay: Math.min(index * 0.03, 0.5),
                        ease: [0.25, 0.46, 0.45, 0.94],
                      }}
                    >
                      {hasMultipleTranslations ? (
                        <GameGroupItem
                          group={group}
                          isExpanded={expandedGroups.has(group.slug)}
                          onToggle={() => toggleGroupExpanded(group.slug)}
                          selectedGameId={selectedGame?.id}
                          onSelectGame={setSelectedGame}
                          gamesWithUpdates={gamesWithUpdates}
                          isGameDetected={isGameDetected}
                        />
                      ) : (
                        <GameListItem
                          game={primaryGame}
                          isSelected={selectedGame?.id === primaryGame.id}
                          onClick={() => setSelectedGame(primaryGame)}
                          hasUpdate={gamesWithUpdates.has(primaryGame.id)}
                          isGameDetected={isGameDetected(primaryGame.id)}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Render alphabet sidebar if there are games */}
        {!isLoading && totalGames > 0 && (
          <AlphabetSidebar
            alphabet={sortedAlphabet}
            onLetterClick={handleLetterClick}
            activeHighlight={activeLetter || undefined}
          />
        )}
      </div>

      <SidebarFooter
        onOpenHistory={onOpenHistory}
        onOpenSettings={openSettingsModal}
        unreadCount={unreadCount}
      />

      {/* Resize handle */}
      <div
        className={`absolute top-0 right-0 w-1 h-full cursor-col-resize group hover:bg-primary/50 transition-colors z-50 ${isResizing ? 'bg-primary/50' : 'bg-transparent'
          }`}
        onMouseDown={handleResizeStart}
      >
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1 h-12 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </GlassPanel>
  );
});
