import { useCallback, useEffect, useRef, useState } from 'react';
import type { SortOrderType } from '../../shared/types';
import type {
  ContentTypeFilterType,
  SpecialFilterType,
  TranslationTypeFilterType,
} from '../components/Sidebar/types';
import { useStore } from '../store/useStore';
import { subscribeToWorkshopInstalledChanges } from '../store/useWorkshopInstallsStore';
import type { Game, GetGamesParams } from '../types/game';
import { allInstalledTranslationIds } from './useInstalledTranslations';

interface UseGamesParams {
  selectedStatuses?: string[];
  selectedAuthors?: string[];
  selectedTagIds?: number[];
  specialFilter?: SpecialFilterType | null;
  selectedContentTypes?: ContentTypeFilterType[];
  selectedTranslationTypes?: TranslationTypeFilterType[];
  searchQuery?: string;
  sortOrder?: SortOrderType;
  hideAiTranslations?: boolean;
}

/** Status group is OR'ed internally, then AND'ed against the other groups. */
function matchesStatuses(game: Game, statuses?: string[]): boolean {
  return !statuses || statuses.length === 0 || statuses.includes(game.status);
}

/** Authors group is OR'ed internally, then AND'ed against the other groups. */
function matchesAuthors(game: Game, authors?: string[]): boolean {
  if (!authors || authors.length === 0) {
    return true;
  }
  if (!game.team) {
    return false;
  }
  return authors.some((author) => game.team?.includes(author));
}

/** Tag group is OR'ed internally, then AND'ed against the other groups. */
function matchesTags(game: Game, tagIds?: number[]): boolean {
  if (!tagIds || tagIds.length === 0) {
    return true;
  }
  return tagIds.some((tagId) => game.steam_tag_ids?.includes(tagId));
}

/** Content-type group (achievements/voice) is AND'ed internally - selecting both requires both. */
function matchesContentTypes(
  game: Game,
  contentTypes?: ContentTypeFilterType[]
): boolean {
  if (!contentTypes || contentTypes.length === 0) {
    return true;
  }
  return contentTypes.every((type) => {
    if (type === 'with-achievements') {
      return !!game.achievements_archive_path;
    }
    if (type === 'from-workshop') {
      return game.kind === 'workshop';
    }
    return !!game.voice_archive_path || game.voice_progress !== null;
  });
}

/** Translation-type group is OR'ed internally, then AND'ed against the other groups. */
function matchesTranslationTypes(
  game: Game,
  translationTypes?: TranslationTypeFilterType[]
): boolean {
  if (!translationTypes || translationTypes.length === 0) {
    return true;
  }
  return translationTypes.some((type) => {
    if (type === 'manual') {
      return game.ai === null;
    }
    if (type === 'ai-edited') {
      return game.ai === 'edited';
    }
    return game.ai === 'non-edited';
  });
}

/** AND-combine every active filter group across a games list. */
function applyGroupFilters(
  games: Game[],
  selectedStatuses?: string[],
  selectedAuthors?: string[],
  selectedContentTypes?: ContentTypeFilterType[],
  selectedTagIds?: number[],
  selectedTranslationTypes?: TranslationTypeFilterType[]
): Game[] {
  return games.filter(
    (game) =>
      matchesStatuses(game, selectedStatuses) &&
      matchesAuthors(game, selectedAuthors) &&
      matchesContentTypes(game, selectedContentTypes) &&
      matchesTags(game, selectedTagIds) &&
      matchesTranslationTypes(game, selectedTranslationTypes)
  );
}

interface UseGamesResult {
  games: Game[];
  total: number;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Hook for fetching games from the local database
 * Since this is a local-first app, we load all games at once
 */
export function useGames({
  selectedStatuses,
  selectedAuthors,
  selectedTagIds,
  specialFilter,
  selectedContentTypes,
  selectedTranslationTypes,
  searchQuery,
  sortOrder = 'name',
  hideAiTranslations = false,
}: UseGamesParams): UseGamesResult {
  // Note: showAdultGames is handled in UI (blur effect), not filtering here
  // AI translations are filtered in SQL via hideAiTranslations param

  const syncStatus = useStore((state) => state.syncStatus);
  const checkSubscribedGamesStatus = useStore(
    (state) => state.checkSubscribedGamesStatus
  );

  const [games, setGames] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasCheckedSubscriptions = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Load games
   */
  const loadGames = useCallback(async () => {
    // Cancel the previous request if it's still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setError(null);

    try {
      // Each "library" branch (favorite/installed/steam/gog/epic/xbox) gets its
      // own set of games via a separate IPC call (by id/paths/names), while statuses,
      // authors and content types (achievements/voice) are applied afterward - as
      // AND filters on the client, so all filter groups combine with each other via AND.
      if (specialFilter === 'favorite-translations') {
        const { useSettingsStore } = await import('../store/useSettingsStore');
        const favoriteGameIds = useSettingsStore.getState().favoriteGameIds;

        // Check if the request is still relevant
        if (signal.aborted) {
          return;
        }

        if (favoriteGameIds.length === 0) {
          setGames([]);
          setTotal(0);
          return;
        }

        // Get favorite games (with SQL search and AI filtering)
        const favoriteGames = await window.electronAPI.fetchGamesByIds(
          favoriteGameIds,
          searchQuery || undefined,
          hideAiTranslations,
          sortOrder
        );

        // Check if the request is still relevant
        if (signal.aborted) {
          return;
        }

        const filtered = applyGroupFilters(
          favoriteGames,
          selectedStatuses,
          selectedAuthors,
          selectedContentTypes,
          selectedTagIds,
          selectedTranslationTypes
        );
        setGames(filtered);
        setTotal(filtered.length);
        return;
      }

      if (specialFilter === 'installed-translations') {
        const installedGameIds = await allInstalledTranslationIds();

        // Check if the request is still relevant
        if (signal.aborted) {
          return;
        }

        if (installedGameIds.length === 0) {
          setGames([]);
          setTotal(0);
          return;
        }

        // Get games with installed translations (with SQL search and AI filtering)
        const installedGames = await window.electronAPI.fetchGamesByIds(
          installedGameIds,
          searchQuery || undefined,
          hideAiTranslations,
          sortOrder
        );

        // Check if the request is still relevant
        if (signal.aborted) {
          return;
        }

        const filtered = applyGroupFilters(
          installedGames,
          selectedStatuses,
          selectedAuthors,
          selectedContentTypes,
          selectedTagIds,
          selectedTranslationTypes
        );
        setGames(filtered);
        setTotal(filtered.length);
        return;
      }

      // Special handling for installed games (on the computer)
      if (specialFilter === 'installed-games') {
        const installPaths = await window.electronAPI.getAllInstalledGamePaths();

        // Check if the request is still relevant
        if (signal.aborted) {
          return;
        }

        if (installPaths.length === 0) {
          setGames([]);
          setTotal(0);
          return;
        }

        // Find games by install paths (with SQL search and AI filtering)
        const result = await window.electronAPI.findGamesByInstallPaths(
          installPaths,
          searchQuery || undefined,
          hideAiTranslations,
          sortOrder
        );

        // Check if the request is still relevant
        if (signal.aborted) {
          return;
        }

        const filtered = applyGroupFilters(
          result.games,
          selectedStatuses,
          selectedAuthors,
          selectedContentTypes,
          selectedTagIds,
          selectedTranslationTypes
        );
        setGames(filtered);
        setTotal(filtered.length);
        return;
      }

      // Special handling for games available from the Steam library
      if (specialFilter === 'available-in-steam') {
        const steamLibraryAppIds = await window.electronAPI.getSteamLibraryAppIds();

        // Check if the request is still relevant
        if (signal.aborted) {
          return;
        }

        if (steamLibraryAppIds.length === 0) {
          setGames([]);
          setTotal(0);
          return;
        }

        // Get games by Steam App IDs (with SQL search and AI filtering)
        const result = await window.electronAPI.findGamesBySteamAppIds(
          steamLibraryAppIds,
          searchQuery || undefined,
          hideAiTranslations,
          sortOrder
        );

        // Check if the request is still relevant
        if (signal.aborted) {
          return;
        }

        const filtered = applyGroupFilters(
          result.games,
          selectedStatuses,
          selectedAuthors,
          selectedContentTypes,
          selectedTagIds,
          selectedTranslationTypes
        );
        setGames(filtered);
        setTotal(filtered.length);
        return;
      }

      // Special handling for GOG Owned Games
      if (specialFilter === 'owned-gog-games') {
        const titles = await window.electronAPI.getGogLibrary();

        if (signal.aborted) {
          return;
        }

        if (titles.length === 0) {
          setGames([]);
          setTotal(0);
          return;
        }

        const result = await window.electronAPI.findGamesByTitles(
          titles,
          searchQuery || undefined,
          hideAiTranslations,
          sortOrder
        );

        if (signal.aborted) {
          return;
        }

        const filtered = applyGroupFilters(
          result.games,
          selectedStatuses,
          selectedAuthors,
          selectedContentTypes,
          selectedTagIds,
          selectedTranslationTypes
        );
        setGames(filtered);
        setTotal(filtered.length);
        return;
      }

      // Special handling for Epic Owned Games
      if (specialFilter === 'owned-epic-games') {
        const titles = await window.electronAPI.getEpicLibrary();

        if (signal.aborted) {
          return;
        }

        if (titles.length === 0) {
          setGames([]);
          setTotal(0);
          return;
        }

        const result = await window.electronAPI.findGamesByTitles(
          titles,
          searchQuery || undefined,
          hideAiTranslations,
          sortOrder
        );

        if (signal.aborted) {
          return;
        }

        const filtered = applyGroupFilters(
          result.games,
          selectedStatuses,
          selectedAuthors,
          selectedContentTypes,
          selectedTagIds,
          selectedTranslationTypes
        );
        setGames(filtered);
        setTotal(filtered.length);
        return;
      }

      // Special handling for Xbox-installed games (parsed from .GamingRoot)
      if (specialFilter === 'installed-xbox-games') {
        const folderNames = await window.electronAPI.getXboxInstalledPaths();

        if (signal.aborted) {
          return;
        }

        if (folderNames.length === 0) {
          setGames([]);
          setTotal(0);
          return;
        }

        const result = await window.electronAPI.findGamesByXboxPaths(
          folderNames,
          searchQuery || undefined,
          hideAiTranslations,
          sortOrder
        );

        if (signal.aborted) {
          return;
        }

        const filtered = applyGroupFilters(
          result.games,
          selectedStatuses,
          selectedAuthors,
          selectedContentTypes,
          selectedTagIds,
          selectedTranslationTypes
        );
        setGames(filtered);
        setTotal(filtered.length);
        return;
      }

      // Without a library filter - statuses, authors and tags are filtered in SQL,
      // content types (achievements/voice) - on the client (AND'ed together).
      const params: GetGamesParams = {
        searchQuery,
        statuses: selectedStatuses,
        authors: selectedAuthors,
        tagIds: selectedTagIds,
        sortOrder,
        hideAiTranslations,
      };

      const result = await window.electronAPI.fetchGames(params);

      // Check if the request is still relevant
      if (signal.aborted) {
        return;
      }

      const filtered = result.games.filter(
        (game) =>
          matchesContentTypes(game, selectedContentTypes) &&
          matchesTranslationTypes(game, selectedTranslationTypes)
      );

      setGames(filtered);
      setTotal(filtered.length);
    } catch (error) {
      // Ignore errors from cancelled requests
      if (signal.aborted) {
        return;
      }

      console.error('[useGames] Error loading games:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Помилка завантаження ігор';
      setError(errorMessage);
      setGames([]);
      setTotal(0);
    } finally {
      // Only update isLoading if the request wasn't cancelled
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [
    specialFilter,
    searchQuery,
    selectedStatuses,
    selectedAuthors,
    selectedTagIds,
    selectedContentTypes,
    selectedTranslationTypes,
    sortOrder,
    hideAiTranslations,
  ]);

  /**
   * Reload
   */
  const reload = useCallback(() => {
    loadGames();
  }, [loadGames]);

  // Load when parameters change (only once sync is complete)
  useEffect(() => {
    // Wait until sync completes (ready or error)
    if (syncStatus !== 'ready' && syncStatus !== 'error') {
      return;
    }
    loadGames();
  }, [loadGames, syncStatus]);

  // [DEV ONLY] Reload games when test data changes
  useEffect(() => {
    const handleTestGamesUpdate = () => loadGames();
    window.addEventListener('test-games-updated', handleTestGamesUpdate);
    return () => window.removeEventListener('test-games-updated', handleTestGamesUpdate);
  }, [loadGames]);

  // Check subscribed games' statuses after the initial load
  useEffect(() => {
    if (!isLoading && games.length > 0 && !hasCheckedSubscriptions.current) {
      hasCheckedSubscriptions.current = true;
      checkSubscribedGamesStatus(games);
    }
  }, [isLoading, games, checkSubscribedGamesStatus]);

  // Listen for realtime updates of individual games
  useEffect(() => {
    if (!window.electronAPI?.onGameUpdated) {
      return;
    }

    const handleGameUpdate = (updatedGame: Game) => {
      console.log('[useGames] Game updated via realtime:', updatedGame.name);

      const { checkSubscribedGamesStatus, checkSubscribedTeamUpdate } =
        useStore.getState();

      // Check subscribed games' status (centralized handling)
      checkSubscribedGamesStatus([updatedGame]);

      setGames((prevGames) => {
        const index = prevGames.findIndex((g) => g.id === updatedGame.id);
        const oldGame = index !== -1 ? prevGames[index] : null;

        // Check team subscriptions (centralized handling)
        checkSubscribedTeamUpdate(updatedGame, oldGame);

        // AND check of statuses, authors and content types - always applied,
        // regardless of the library filter, since all filter groups combine via AND
        const matchesGroups =
          matchesStatuses(updatedGame, selectedStatuses) &&
          matchesAuthors(updatedGame, selectedAuthors) &&
          matchesContentTypes(updatedGame, selectedContentTypes) &&
          matchesTags(updatedGame, selectedTagIds) &&
          matchesTranslationTypes(updatedGame, selectedTranslationTypes);

        // For library filters (installed-games, available-in-steam, etc.) membership
        // (whether a game belongs to the library at all) is determined by separate listeners,
        // so here we only update/remove already-present games - we don't add new ones
        const isLibraryFilter =
          specialFilter === 'installed-games' ||
          specialFilter === 'installed-translations' ||
          specialFilter === 'favorite-translations' ||
          specialFilter === 'available-in-steam' ||
          specialFilter === 'owned-gog-games' ||
          specialFilter === 'owned-epic-games' ||
          specialFilter === 'installed-xbox-games';

        if (isLibraryFilter) {
          if (index === -1) {
            return prevGames;
          }
          if (!matchesGroups) {
            setTotal((prev) => prev - 1);
            return prevGames.filter((g) => g.id !== updatedGame.id);
          }
          const newGames = [...prevGames];
          newGames[index] = updatedGame;
          return newGames;
        }

        // Simple search check - full filtering happens on the next reload
        const matchesSearch =
          !searchQuery ||
          updatedGame.name.toLowerCase().includes(searchQuery.toLowerCase());

        // Adult games are always shown in list (with blur overlay in UI)
        const shouldBeInList = matchesSearch && matchesGroups && updatedGame.approved;

        if (index === -1) {
          // Game not in the list
          if (!shouldBeInList) {
            return prevGames;
          }

          // Add the game to the end (exact position determined on next reload)
          setTotal((prev) => prev + 1);
          return [...prevGames, updatedGame];
        }
        // Game is in the list
        if (!shouldBeInList) {
          // Remove the game if it no longer matches the filters
          setTotal((prev) => prev - 1);
          return prevGames.filter((g) => g.id !== updatedGame.id);
        }

        // Update the game data in place, preserving the current order
        const newGames = [...prevGames];
        newGames[index] = updatedGame;
        return newGames;
      });
    };

    const unsubscribe = window.electronAPI.onGameUpdated(handleGameUpdate);
    const unsubscribeCounters = window.electronAPI.onGameCountersUpdated?.(
      (updatedGame: Game) => {
        setGames((prevGames) => {
          const index = prevGames.findIndex((g) => g.id === updatedGame.id);
          if (index === -1) {
            return prevGames;
          }
          const newGames = [...prevGames];
          newGames[index] = updatedGame;
          return newGames;
        });
      }
    );
    return () => {
      unsubscribe();
      unsubscribeCounters?.();
    };
  }, [
    searchQuery,
    specialFilter,
    selectedStatuses,
    selectedAuthors,
    selectedTagIds,
    selectedContentTypes,
    selectedTranslationTypes,
  ]);

  // Listen for realtime game deletions
  useEffect(() => {
    if (!window.electronAPI?.onGameRemoved) {
      return;
    }

    const handleGameRemoved = (gameId: string) => {
      console.log('[useGames] Game removed via realtime:', gameId);

      // Remove the game from the list if it's there
      setGames((prevGames) => {
        const filtered = prevGames.filter((g) => g.id !== gameId);
        if (filtered.length !== prevGames.length) {
          setTotal((prev) => prev - 1);
        }
        return filtered;
      });
    };

    const unsubscribe = window.electronAPI.onGameRemoved(handleGameRemoved);
    return unsubscribe;
  }, []);

  // Listen for changes in installed translations (install/uninstall)
  // Re-register the listener when specialFilter changes so the closure stays correct
  useEffect(() => {
    if (!window.electronAPI?.onInstalledGamesChanged) {
      return;
    }
    // Only subscribe if the corresponding filter is active
    if (specialFilter !== 'installed-translations') {
      return;
    }

    const handleInstalledGamesChanged = () => {
      console.log('[useGames] Installed translations changed, reloading list');
      loadGames();
    };

    const unsubscribe = window.electronAPI.onInstalledGamesChanged(
      handleInstalledGamesChanged
    );

    const unsubscribeWorkshop = subscribeToWorkshopInstalledChanges(
      handleInstalledGamesChanged
    );
    return () => {
      unsubscribe();
      unsubscribeWorkshop();
    };
  }, [specialFilter, loadGames]);

  // Listen for Steam library changes (for the installed games and available-in-Steam tabs)
  // Re-register the listener when specialFilter changes so the closure stays correct
  useEffect(() => {
    if (!window.electronAPI?.onSteamLibraryChanged) {
      return;
    }
    // Only subscribe if the corresponding filter is active
    if (specialFilter !== 'installed-games' && specialFilter !== 'available-in-steam') {
      return;
    }

    const handleSteamLibraryChanged = () => {
      console.log('[useGames] Steam library changed, reloading list');
      loadGames();
    };

    const unsubscribe = window.electronAPI.onSteamLibraryChanged(
      handleSteamLibraryChanged
    );
    return unsubscribe;
  }, [specialFilter, loadGames]);

  // Cleanup abort controller on unmount
  useEffect(
    () => () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    },
    []
  );

  return {
    games,
    total,
    isLoading,
    error,
    reload,
  };
}
