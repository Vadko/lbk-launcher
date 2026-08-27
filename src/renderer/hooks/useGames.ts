import { useCallback, useEffect, useRef, useState } from 'react';
import type { SortOrderType } from '../../shared/types';
import type {
  ContentTypeFilterType,
  SpecialFilterType,
} from '../components/Sidebar/types';
import { useStore } from '../store/useStore';
import type { Game, GetGamesParams } from '../types/game';

interface UseGamesParams {
  selectedStatuses?: string[];
  selectedAuthors?: string[];
  specialFilter?: SpecialFilterType | null;
  selectedContentTypes?: ContentTypeFilterType[];
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

/** AND-combine every active filter group across a games list. */
function applyGroupFilters(
  games: Game[],
  selectedStatuses?: string[],
  selectedAuthors?: string[],
  selectedContentTypes?: ContentTypeFilterType[]
): Game[] {
  return games.filter(
    (game) =>
      matchesStatuses(game, selectedStatuses) &&
      matchesAuthors(game, selectedAuthors) &&
      matchesContentTypes(game, selectedContentTypes)
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
 * Хук для отримання ігор з локальної бази даних
 * Оскільки це local-first застосунок, завантажуємо всі ігри одразу
 */
export function useGames({
  selectedStatuses,
  selectedAuthors,
  specialFilter,
  selectedContentTypes,
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
   * Завантажити ігри
   */
  const loadGames = useCallback(async () => {
    // Скасувати попередній запит якщо він ще виконується
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setError(null);

    try {
      // Кожна "бібліотечна" гілка (favorite/installed/steam/gog/epic/xbox) отримує свій
      // набір ігор через окремий IPC-виклик (за id/шляхами/назвами), а статуси, автори
      // та типи контенту (досягнення/озвучення) застосовуються після - як AND-фільтри
      // на клієнті, щоб усі групи фільтрів комбінувались між собою через AND.
      if (specialFilter === 'favorite-translations') {
        const { useSettingsStore } = await import('../store/useSettingsStore');
        const favoriteGameIds = useSettingsStore.getState().favoriteGameIds;

        // Перевірити чи запит ще актуальний
        if (signal.aborted) {
          return;
        }

        if (favoriteGameIds.length === 0) {
          setGames([]);
          setTotal(0);
          return;
        }

        // Отримати улюблені ігри (з SQL фільтрацією пошуку та AI)
        const favoriteGames = await window.electronAPI.fetchGamesByIds(
          favoriteGameIds,
          searchQuery || undefined,
          hideAiTranslations,
          sortOrder
        );

        // Перевірити чи запит ще актуальний
        if (signal.aborted) {
          return;
        }

        const filtered = applyGroupFilters(
          favoriteGames,
          selectedStatuses,
          selectedAuthors,
          selectedContentTypes
        );
        setGames(filtered);
        setTotal(filtered.length);
        return;
      }

      if (specialFilter === 'installed-translations') {
        const installedGameIds = [
          ...new Set(await window.electronAPI.getAllInstalledGameIds()),
        ];

        // Перевірити чи запит ще актуальний
        if (signal.aborted) {
          return;
        }

        if (installedGameIds.length === 0) {
          setGames([]);
          setTotal(0);
          return;
        }

        // Отримати ігри зі встановленими українізаторами (з SQL фільтрацією пошуку та AI)
        const installedGames = await window.electronAPI.fetchGamesByIds(
          installedGameIds,
          searchQuery || undefined,
          hideAiTranslations,
          sortOrder
        );

        // Перевірити чи запит ще актуальний
        if (signal.aborted) {
          return;
        }

        const filtered = applyGroupFilters(
          installedGames,
          selectedStatuses,
          selectedAuthors,
          selectedContentTypes
        );
        setGames(filtered);
        setTotal(filtered.length);
        return;
      }

      // Спеціальна обробка для встановлених ігор (на комп'ютері)
      if (specialFilter === 'installed-games') {
        const installPaths = await window.electronAPI.getAllInstalledGamePaths();

        // Перевірити чи запит ще актуальний
        if (signal.aborted) {
          return;
        }

        if (installPaths.length === 0) {
          setGames([]);
          setTotal(0);
          return;
        }

        // Знайти ігри за шляхами встановлення (з SQL фільтрацією пошуку та AI)
        const result = await window.electronAPI.findGamesByInstallPaths(
          installPaths,
          searchQuery || undefined,
          hideAiTranslations,
          sortOrder
        );

        // Перевірити чи запит ще актуальний
        if (signal.aborted) {
          return;
        }

        const filtered = applyGroupFilters(
          result.games,
          selectedStatuses,
          selectedAuthors,
          selectedContentTypes
        );
        setGames(filtered);
        setTotal(filtered.length);
        return;
      }

      // Спеціальна обробка для ігор доступних зі Steam бібліотеки
      if (specialFilter === 'available-in-steam') {
        const steamLibraryAppIds = await window.electronAPI.getSteamLibraryAppIds();

        // Перевірити чи запит ще актуальний
        if (signal.aborted) {
          return;
        }

        if (steamLibraryAppIds.length === 0) {
          setGames([]);
          setTotal(0);
          return;
        }

        // Отримати ігри за Steam App IDs (з SQL фільтрацією пошуку та AI)
        const result = await window.electronAPI.findGamesBySteamAppIds(
          steamLibraryAppIds,
          searchQuery || undefined,
          hideAiTranslations,
          sortOrder
        );

        // Перевірити чи запит ще актуальний
        if (signal.aborted) {
          return;
        }

        const filtered = applyGroupFilters(
          result.games,
          selectedStatuses,
          selectedAuthors,
          selectedContentTypes
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
          selectedContentTypes
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
          selectedContentTypes
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
          selectedContentTypes
        );
        setGames(filtered);
        setTotal(filtered.length);
        return;
      }

      // Без бібліотечного фільтру - статуси й автори фільтруються в SQL,
      // типи контенту (досягнення/озвучення) - на клієнті (AND між собою).
      const params: GetGamesParams = {
        searchQuery,
        statuses: selectedStatuses,
        authors: selectedAuthors,
        sortOrder,
        hideAiTranslations,
      };

      const result = await window.electronAPI.fetchGames(params);

      // Перевірити чи запит ще актуальний
      if (signal.aborted) {
        return;
      }

      const filtered =
        selectedContentTypes && selectedContentTypes.length > 0
          ? result.games.filter((game) => matchesContentTypes(game, selectedContentTypes))
          : result.games;

      setGames(filtered);
      setTotal(filtered.length);
    } catch (error) {
      // Ігноруємо помилки від скасованих запитів
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
      // Оновлюємо isLoading тільки якщо запит не скасовано
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [
    specialFilter,
    searchQuery,
    selectedStatuses,
    selectedAuthors,
    selectedContentTypes,
    sortOrder,
    hideAiTranslations,
  ]);

  /**
   * Перезавантажити
   */
  const reload = useCallback(() => {
    loadGames();
  }, [loadGames]);

  // Завантажити при зміні параметрів (тільки коли sync завершено)
  useEffect(() => {
    // Чекаємо поки sync завершиться (ready або error)
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

  // Перевірити статуси підписаних ігор після першого завантаження
  useEffect(() => {
    if (!isLoading && games.length > 0 && !hasCheckedSubscriptions.current) {
      hasCheckedSubscriptions.current = true;
      checkSubscribedGamesStatus(games);
    }
  }, [isLoading, games, checkSubscribedGamesStatus]);

  // Слухати realtime оновлення окремих ігор
  useEffect(() => {
    if (!window.electronAPI?.onGameUpdated) {
      return;
    }

    const handleGameUpdate = (updatedGame: Game) => {
      console.log('[useGames] Game updated via realtime:', updatedGame.name);

      const { checkSubscribedGamesStatus, checkSubscribedTeamUpdate } =
        useStore.getState();

      // Перевірити статус підписаних ігор (централізована обробка)
      checkSubscribedGamesStatus([updatedGame]);

      setGames((prevGames) => {
        const index = prevGames.findIndex((g) => g.id === updatedGame.id);
        const oldGame = index !== -1 ? prevGames[index] : null;

        // Перевірити підписки на команди (централізована обробка)
        checkSubscribedTeamUpdate(updatedGame, oldGame);

        // AND-перевірка статусів, авторів та типів контенту - завжди застосовується,
        // незалежно від бібліотечного фільтру, бо всі групи фільтрів комбінуються через AND
        const matchesGroups =
          matchesStatuses(updatedGame, selectedStatuses) &&
          matchesAuthors(updatedGame, selectedAuthors) &&
          matchesContentTypes(updatedGame, selectedContentTypes);

        // Для бібліотечних фільтрів (installed-games, available-in-steam, тощо) membership
        // (чи гра взагалі належить бібліотеці) визначається окремими listeners, тож тут
        // ми лише оновлюємо/видаляємо вже присутні ігри - не додаємо нових
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

        // Проста перевірка пошуку - повна фільтрація відбудеться при наступному reload
        const matchesSearch =
          !searchQuery ||
          updatedGame.name.toLowerCase().includes(searchQuery.toLowerCase());

        // Adult games are always shown in list (with blur overlay in UI)
        const shouldBeInList = matchesSearch && matchesGroups && updatedGame.approved;

        if (index === -1) {
          // Гра не в списку
          if (!shouldBeInList) {
            return prevGames;
          }

          // Додати гру в кінець (точна позиція визначиться при наступному reload)
          setTotal((prev) => prev + 1);
          return [...prevGames, updatedGame];
        }
        // Гра є в списку
        if (!shouldBeInList) {
          // Видалити гру, якщо вона більше не відповідає фільтрам
          setTotal((prev) => prev - 1);
          return prevGames.filter((g) => g.id !== updatedGame.id);
        }

        // Оновити дані гри in-place, зберігаючи поточний порядок
        const newGames = [...prevGames];
        newGames[index] = updatedGame;
        return newGames;
      });
    };

    const unsubscribe = window.electronAPI.onGameUpdated(handleGameUpdate);
    return unsubscribe;
  }, [
    searchQuery,
    specialFilter,
    selectedStatuses,
    selectedAuthors,
    selectedContentTypes,
  ]);

  // Слухати realtime видалення ігор
  useEffect(() => {
    if (!window.electronAPI?.onGameRemoved) {
      return;
    }

    const handleGameRemoved = (gameId: string) => {
      console.log('[useGames] Game removed via realtime:', gameId);

      // Видалити гру зі списку, якщо вона там є
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

  // Слухати зміни у встановлених українізаторах (install/uninstall)
  // Перереєструємо listener при зміні specialFilter для коректної роботи closure
  useEffect(() => {
    if (!window.electronAPI?.onInstalledGamesChanged) {
      return;
    }
    // Підписуємось тільки якщо активний відповідний фільтр
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
    return unsubscribe;
  }, [specialFilter, loadGames]);

  // Слухати зміни Steam бібліотеки (для вкладки встановлених ігор та доступних зі Steam)
  // Перереєструємо listener при зміні specialFilter для коректної роботи closure
  useEffect(() => {
    if (!window.electronAPI?.onSteamLibraryChanged) {
      return;
    }
    // Підписуємось тільки якщо активний відповідний фільтр
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

  // Cleanup abort controller при unmount
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
