import React, { useEffect, useRef, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '../Layout/GlassPanel';
import { SearchBar } from './SearchBar';
import { GameListItem } from './GameListItem';
import { FilterDropdown } from './FilterDropdown';
import { TeamFilterDropdown } from './TeamFilterDropdown';
import { SidebarHeader } from './SidebarHeader';
import { SidebarFooter } from './SidebarFooter';
import { GameGroupItem } from './GameGroupItem';
import { GamepadCard } from './GamepadCard';
import { Loader } from '../ui/Loader';
import { useStore } from '../../store/useStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useSubscriptionsStore } from '../../store/useSubscriptionsStore';
import { useGamepadModeStore } from '../../store/useGamepadModeStore';
import { useGames } from '../../hooks/useGames';
import { useDebounce } from '../../hooks/useDebounce';
import type { GameGroup } from './types';

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
    filter,
    teamFilter,
    searchQuery,
    setSelectedGame,
    setFilter,
    setTeamFilter,
    setSearchQuery,
    gamesWithUpdates,
    isGameDetected,
    loadInstalledGamesFromSystem,
  } = useStore();
  const { openSettingsModal } = useSettingsStore();
  const unreadCount = useSubscriptionsStore((state) => state.unreadCount);
  const { setGamepadMode, setUserDisabledGamepadMode } = useGamepadModeStore();

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Fetch teams list
  const [teams, setTeams] = useState<string[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const fetchedTeams = await window.electronAPI.fetchTeams();
        setTeams(fetchedTeams);
      } catch (error) {
        console.error('[Sidebar] Error fetching teams:', error);
      } finally {
        setTeamsLoading(false);
      }
    };
    loadTeams();
  }, []);

  const {
    games: visibleGames,
    total: totalGames,
    isLoading,
  } = useGames({
    filter,
    searchQuery: debouncedSearchQuery,
    team: teamFilter,
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
            <FilterDropdown value={filter} onChange={setFilter} />
          </div>
          <div className="flex-1 min-w-0 max-w-[220px]" data-gamepad-header-item>
            <TeamFilterDropdown
              value={teamFilter}
              onChange={setTeamFilter}
              teams={teams}
              isLoading={teamsLoading}
            />
          </div>

          {/* Actions */}
          <SidebarFooter
            onOpenHistory={onOpenHistory}
            onOpenSettings={openSettingsModal}
            unreadCount={unreadCount}
            isCompact={true}
            onSwitchToDesktop={() => {
              setGamepadMode(false);
              setUserDisabledGamepadMode(true);
            }}
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

                return (
                  <GamepadCard
                    key={group.slug}
                    game={primaryGame}
                    isSelected={isSelected}
                    hasUpdate={hasUpdate}
                    isDetected={detected}
                    onClick={() => setSelectedGame(primaryGame)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vertical layout (default)
  return (
    <GlassPanel className="w-[320px] h-full flex flex-col">
      <SidebarHeader />

      <div className="p-4">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* Filters row */}
      <div className="flex gap-2 px-4 pb-4">
        <FilterDropdown value={filter} onChange={setFilter} />
        <TeamFilterDropdown
          value={teamFilter}
          onChange={setTeamFilter}
          teams={teams}
          isLoading={teamsLoading}
        />
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
              {gameGroups.map((group, index) => {
                const hasMultipleTranslations = group.translations.length > 1;
                const primaryGame = group.translations[0];

                return (
                  <motion.div
                    key={group.slug}
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

      <SidebarFooter
        onOpenHistory={onOpenHistory}
        onOpenSettings={openSettingsModal}
        unreadCount={unreadCount}
      />
    </GlassPanel>
  );
});
