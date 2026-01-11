import { useState, useCallback, useEffect, useRef } from 'react';
import type { Game, GetGamesParams } from '../types/game';
import type { SpecialFilterType } from '../components/Sidebar/types';
import { useSubscriptionsStore } from '../store/useSubscriptionsStore';
import { useStore } from '../store/useStore';

interface UseGamesParams {
  selectedStatuses: string[];
  selectedAuthors: string[];
  specialFilter: SpecialFilterType | null;
  searchQuery: string;
  sortOrder?: 'name' | 'downloads';
  showAiTranslations?: boolean;
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
  searchQuery,
  sortOrder = 'name',
  showAiTranslations = false,
}: UseGamesParams): UseGamesResult {
  // Note: showAdultGames is handled in UI (blur effect), not filtering here
  // AI translations are filtered in SQL via showAiTranslations param

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
      // Спеціальна обробка для встановлених українізаторів
      if (specialFilter === 'installed-translations') {
        const installedGameIds = [
          ...new Set(await window.electronAPI.getAllInstalledGameIds()),
        ];

        // Перевірити чи запит ще актуальний
        if (signal.aborted) return;

        if (installedGameIds.length === 0) {
          setGames([]);
          setTotal(0);
          return;
        }

        // Отримати ігри зі встановленими українізаторами (з SQL фільтрацією пошуку та AI)
        const installedGames = await window.electronAPI.fetchGamesByIds(
          installedGameIds,
          searchQuery || undefined,
          showAiTranslations
        );

        // Перевірити чи запит ще актуальний
        if (signal.aborted) return;

        setGames(installedGames);
        setTotal(installedGames.length);
        return;
      }

      // Спеціальна обробка для встановлених ігор (на комп'ютері)
      if (specialFilter === 'installed-games') {
        const installPaths = await window.electronAPI.getAllInstalledGamePaths();

        // Перевірити чи запит ще актуальний
        if (signal.aborted) return;

        if (installPaths.length === 0) {
          setGames([]);
          setTotal(0);
          return;
        }

        // Знайти ігри за шляхами встановлення (з SQL фільтрацією пошуку та AI)
        const result = await window.electronAPI.findGamesByInstallPaths(
          installPaths,
          searchQuery || undefined,
          showAiTranslations
        );

        // Перевірити чи запит ще актуальний
        if (signal.aborted) return;

        setGames(result.games);
        setTotal(result.total);
        return;
      }

      // Спеціальна обробка для ігор з перекладом досягнень
      if (specialFilter === 'with-achievements') {
        const params: GetGamesParams = {
          searchQuery,
          statuses: selectedStatuses,
          authors: selectedAuthors,
          sortOrder,
          showAiTranslations,
        };

        const result = await window.electronAPI.fetchGames(params);

        // Перевірити чи запит ще актуальний
        if (signal.aborted) return;

        // Filter games that have achievements archive
        const withAchievements = result.games.filter(
          (game) => !!game.achievements_archive_path
        );

        setGames(withAchievements);
        setTotal(withAchievements.length);
        return;
      }

      // Для інших фільтрів - завантажити всі ігри одразу
      const params: GetGamesParams = {
        searchQuery,
        statuses: selectedStatuses,
        authors: selectedAuthors,
        sortOrder,
        showAiTranslations,
      };

      const result = await window.electronAPI.fetchGames(params);

      // Перевірити чи запит ще актуальний
      if (signal.aborted) return;

      setGames(result.games);
      setTotal(result.total);
    } catch (error) {
      // Ігноруємо помилки від скасованих запитів
      if (signal.aborted) return;

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
  }, [specialFilter, searchQuery, selectedStatuses, selectedAuthors, sortOrder, showAiTranslations]);

  /**
   * Перезавантажити
   */
  const reload = useCallback(() => {
    loadGames();
  }, [loadGames]);

  // Завантажити при зміні параметрів
  useEffect(() => {
    loadGames();
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
    if (!window.electronAPI?.onGameUpdated) return;

    const handleGameUpdate = (updatedGame: Game) => {
      console.log('[useGames] Game updated via realtime:', updatedGame.name);

      // Перевірити зміну версії для історії
      const { addVersionUpdateNotification, hasNotifiedVersion } =
        useSubscriptionsStore.getState();
      const { installedGames, checkSubscribedGamesStatus, checkSubscribedTeamUpdate } =
        useStore.getState();

      // Перевірити статус підписаних ігор (централізована обробка)
      checkSubscribedGamesStatus([updatedGame]);

      setGames((prevGames) => {
        const index = prevGames.findIndex((g) => g.id === updatedGame.id);
        const oldGame = index !== -1 ? prevGames[index] : null;

        // Перевірити підписки на команди (централізована обробка)
        checkSubscribedTeamUpdate(updatedGame, oldGame);

        if (oldGame) {
          // Перевірити оновлення версії (тільки для встановлених українізаторів)
          const isInstalled = installedGames.has(updatedGame.id);
          if (
            isInstalled &&
            oldGame.version &&
            updatedGame.version &&
            oldGame.version !== updatedGame.version
          ) {
            // Перевірити чи ми вже показували сповіщення для цієї версії
            // (навіть якщо користувач закрив сповіщення)
            if (!hasNotifiedVersion(updatedGame.id, updatedGame.version)) {
              addVersionUpdateNotification(
                updatedGame.id,
                updatedGame.name,
                oldGame.version,
                updatedGame.version
              );
            }
          }
        }

        // Для спеціальних фільтрів (installed-games, installed-translations)
        // просто оновлюємо дані гри якщо вона вже в списку, не додаємо/видаляємо
        if (
          specialFilter === 'installed-games' ||
          specialFilter === 'installed-translations'
        ) {
          if (index !== -1) {
            // Гра є в списку - оновити дані
            const newGames = [...prevGames];
            newGames[index] = updatedGame;
            return newGames;
          }
          // Гра не в списку - не додаємо (membership визначається окремими listeners)
          return prevGames;
        }

        if (specialFilter === 'with-achievements') {
          if (!updatedGame.achievements_archive_path) {
            // Якщо у гри зник переклад досягнень - видалити зі списку
            if (index !== -1) {
              setTotal((prev) => prev - 1);
              return prevGames.filter((g) => g.id !== updatedGame.id);
            }
            return prevGames;
          }
          // Якщо гра має переклад досягнень - продовжити перевірку інших фільтрів
        }

        // Перевірити чи гра відповідає поточному фільтру пошуку
        // Проста перевірка - повна фільтрація відбудеться при наступному reload
        const matchesSearch =
          !searchQuery || updatedGame.name.toLowerCase().includes(searchQuery.toLowerCase());

        // Перевірити чи гра відповідає поточному фільтру статусу (multi-select)
        const matchesStatus =
          selectedStatuses?.length === 0 ||
          selectedStatuses?.includes(updatedGame.status);

        // Перевірити чи гра відповідає фільтру авторів (multi-select)
        const matchesAuthors =
          selectedAuthors?.length === 0 ||
          selectedAuthors?.some((author) => updatedGame.team?.includes(author));

        // Adult games are always shown in list (with blur overlay in UI)
        const shouldBeInList =
          matchesSearch && matchesStatus && matchesAuthors && updatedGame.approved;

        if (index === -1) {
          // Гра не в списку
          if (!shouldBeInList) return prevGames;

          // Додати гру і відсортувати (латиниця перед кирилицею, як в БД)
          const newGames = [...prevGames, updatedGame];
          newGames.sort((a, b) => a.name.localeCompare(b.name));
          setTotal((prev) => prev + 1);
          return newGames;
        }
        // Гра є в списку
        if (!shouldBeInList) {
          // Видалити гру, якщо вона більше не відповідає фільтрам
          setTotal((prev) => prev - 1);
          return prevGames.filter((g) => g.id !== updatedGame.id);
        }

        // Оновити гру і пересортувати (латиниця перед кирилицею, як в БД)
        const newGames = [...prevGames];
        newGames[index] = updatedGame;
        newGames.sort((a, b) => a.name.localeCompare(b.name));
        return newGames;
      });
    };

    const unsubscribe = window.electronAPI.onGameUpdated(handleGameUpdate);
    return unsubscribe;
  }, [searchQuery, specialFilter, selectedStatuses, selectedAuthors]);

  // Слухати realtime видалення ігор
  useEffect(() => {
    if (!window.electronAPI?.onGameRemoved) return;

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
    if (!window.electronAPI?.onInstalledGamesChanged) return;
    // Підписуємось тільки якщо активний відповідний фільтр
    if (specialFilter !== 'installed-translations') return;

    const handleInstalledGamesChanged = () => {
      console.log('[useGames] Installed translations changed, reloading list');
      loadGames();
    };

    const unsubscribe = window.electronAPI.onInstalledGamesChanged(
      handleInstalledGamesChanged
    );
    return unsubscribe;
  }, [specialFilter, loadGames]);

  // Слухати зміни Steam бібліотеки (для вкладки встановлених ігор)
  // Перереєструємо listener при зміні specialFilter для коректної роботи closure
  useEffect(() => {
    if (!window.electronAPI?.onSteamLibraryChanged) return;
    // Підписуємось тільки якщо активний відповідний фільтр
    if (specialFilter !== 'installed-games') return;

    const handleSteamLibraryChanged = () => {
      console.log('[useGames] Steam library changed, reloading installed games list');
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
