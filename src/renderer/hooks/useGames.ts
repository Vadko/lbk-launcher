import { useState, useCallback, useEffect, useRef } from 'react';
import type { Game, GetGamesParams } from '../types/game';
import { useSubscriptionsStore } from '../store/useSubscriptionsStore';
import { useStore } from '../store/useStore';

interface UseGamesParams {
  filter: string;
  searchQuery: string;
  team?: string | null;
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
 * Оскільки це local-first додаток, завантажуємо всі ігри одразу
 */
export function useGames({ filter, searchQuery, team }: UseGamesParams): UseGamesResult {
  // Note: showAdultGames is handled in UI (blur effect), not filtering here
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
      if (filter === 'installed-translations') {
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

        // Отримати всі ігри зі встановленими українізаторами
        const installedGames = await window.electronAPI.fetchGamesByIds(installedGameIds);

        // Перевірити чи запит ще актуальний
        if (signal.aborted) return;

        // Застосувати пошук
        let filteredGames = installedGames;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filteredGames = installedGames.filter((game) =>
            game.name.toLowerCase().includes(query)
          );
        }

        setGames(filteredGames);
        setTotal(filteredGames.length);
        return;
      }

      // Спеціальна обробка для встановлених ігор (на комп'ютері)
      if (filter === 'installed-games') {
        const installPaths = await window.electronAPI.getAllInstalledGamePaths();

        // Перевірити чи запит ще актуальний
        if (signal.aborted) return;

        if (installPaths.length === 0) {
          setGames([]);
          setTotal(0);
          return;
        }

        // Знайти ігри за шляхами встановлення
        const result = await window.electronAPI.findGamesByInstallPaths(installPaths);

        // Перевірити чи запит ще актуальний
        if (signal.aborted) return;

        // Застосувати пошук
        let filteredGames = result.games;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filteredGames = result.games.filter((game) =>
            game.name.toLowerCase().includes(query)
          );
        }

        setGames(filteredGames);
        setTotal(filteredGames.length);
        return;
      }

      // Для інших фільтрів - завантажити всі ігри одразу
      // Note: showAdultGames is no longer passed - adult games are always loaded
      // and shown with blur effect in UI when setting is off
      const params: GetGamesParams = {
        searchQuery,
        filter,
        team: team || undefined,
      };

      const result = await window.electronAPI.fetchGames(params);

      // Перевірити чи запит ще актуальний
      if (signal.aborted) return;

      console.log(
        '[useGames] Setting games:',
        result.games.length,
        'total:',
        result.total
      );
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
  }, [filter, searchQuery, team]);

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
      const { addVersionUpdateNotification, notifications } =
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
            // Перевірити чи вже є така нотифікація (уникнення дублікатів)
            const hasExistingVersionNotification = notifications.some(
              (n) =>
                n.type === 'version-update' &&
                n.gameId === updatedGame.id &&
                n.newValue === updatedGame.version
            );

            if (!hasExistingVersionNotification) {
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
        if (filter === 'installed-games' || filter === 'installed-translations') {
          if (index !== -1) {
            // Гра є в списку - оновити дані
            const newGames = [...prevGames];
            newGames[index] = updatedGame;
            return newGames;
          }
          // Гра не в списку - не додаємо (membership визначається окремими listeners)
          return prevGames;
        }

        // Перевірити чи гра відповідає поточному фільтру пошуку
        const matchesSearch =
          !searchQuery ||
          updatedGame.name.toLowerCase().includes(searchQuery.toLowerCase());

        // Перевірити чи гра відповідає поточному фільтру статусу
        const matchesFilter =
          filter === 'all' ||
          (filter === 'completed' && updatedGame.status === 'completed') ||
          (filter === 'in-progress' && updatedGame.status === 'in-progress') ||
          (filter === 'planned' && updatedGame.status === 'planned');

        // Перевірити чи гра відповідає фільтру команди
        const matchesTeam = !team || updatedGame.team === team;

        // Adult games are always shown in list (with blur overlay in UI)
        const shouldBeInList = matchesSearch && matchesFilter && matchesTeam && updatedGame.approved;

        if (index === -1) {
          // Гра не в списку
          if (!shouldBeInList) return prevGames;

          // Додати гру і відсортувати за алфавітом
          const newGames = [...prevGames, updatedGame];
          newGames.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
          setTotal((prev) => prev + 1);
          return newGames;
        } else {
          // Гра є в списку
          if (!shouldBeInList) {
            // Видалити гру, якщо вона більше не відповідає фільтрам
            setTotal((prev) => prev - 1);
            return prevGames.filter((g) => g.id !== updatedGame.id);
          }

          // Оновити гру і пересортувати
          const newGames = [...prevGames];
          newGames[index] = updatedGame;
          newGames.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
          return newGames;
        }
      });
    };

    const unsubscribe = window.electronAPI.onGameUpdated(handleGameUpdate);
    return unsubscribe;
  }, [searchQuery, filter, team]);

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
  // Перереєструємо listener при зміні filter для коректної роботи closure
  useEffect(() => {
    if (!window.electronAPI?.onInstalledGamesChanged) return;
    // Підписуємось тільки якщо активний відповідний фільтр
    if (filter !== 'installed-translations') return;

    const handleInstalledGamesChanged = () => {
      console.log('[useGames] Installed translations changed, reloading list');
      loadGames();
    };

    const unsubscribe = window.electronAPI.onInstalledGamesChanged(
      handleInstalledGamesChanged
    );
    return unsubscribe;
  }, [filter, loadGames]);

  // Слухати зміни Steam бібліотеки (для вкладки встановлених ігор)
  // Перереєструємо listener при зміні filter для коректної роботи closure
  useEffect(() => {
    if (!window.electronAPI?.onSteamLibraryChanged) return;
    // Підписуємось тільки якщо активний відповідний фільтр
    if (filter !== 'installed-games') return;

    const handleSteamLibraryChanged = () => {
      console.log('[useGames] Steam library changed, reloading installed games list');
      loadGames();
    };

    const unsubscribe = window.electronAPI.onSteamLibraryChanged(
      handleSteamLibraryChanged
    );
    return unsubscribe;
  }, [filter, loadGames]);

  // Cleanup abort controller при unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    games,
    total,
    isLoading,
    error,
    reload,
  };
}
