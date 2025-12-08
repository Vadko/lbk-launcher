import { useState, useCallback, useEffect } from 'react';
import type { Game, GetGamesParams } from '../types/game';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSubscriptionsStore } from '../store/useSubscriptionsStore';

interface UseGamesParams {
  filter: string;
  searchQuery: string;
}

interface UseGamesResult {
  games: Game[];
  total: number;
  isLoading: boolean;
  reload: () => void;
}

/**
 * Хук для отримання ігор з локальної бази даних
 * Оскільки це local-first додаток, завантажуємо всі ігри одразу
 */
export function useGames({ filter, searchQuery }: UseGamesParams): UseGamesResult {
  const showAdultGames = useSettingsStore((state) => state.showAdultGames);

  const [games, setGames] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Завантажити ігри
   */
  const loadGames = useCallback(async () => {
    try {
      // Спеціальна обробка для встановлених перекладів
      if (filter === 'installed-translations') {
        const installedGameIds = [...new Set(await window.electronAPI.getAllInstalledGameIds())];

        if (installedGameIds.length === 0) {
          setGames([]);
          setTotal(0);
          return;
        }

        // Отримати всі ігри зі встановленими перекладами
        const installedGames = await window.electronAPI.fetchGamesByIds(installedGameIds);

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

        if (installPaths.length === 0) {
          setGames([]);
          setTotal(0);
          return;
        }

        // Знайти ігри за шляхами встановлення
        const result = await window.electronAPI.findGamesByInstallPaths(installPaths);

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
      const params: GetGamesParams = {
        searchQuery,
        filter,
        showAdultGames,
      };

      const result = await window.electronAPI.fetchGames(params);
      setGames(result.games);
      setTotal(result.total);
    } catch (error) {
      console.error('[useGames] Error loading games:', error);
      setGames([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [filter, searchQuery, showAdultGames]);

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

  // Слухати realtime оновлення окремих ігор
  useEffect(() => {
    if (!window.electronAPI?.onGameUpdated) return;

    const handleGameUpdate = (updatedGame: Game) => {
      console.log('[useGames] Game updated via realtime:', updatedGame.name);

      // Перевірити зміну статусу/версії для історії
      const { isSubscribed, addNotification, addVersionUpdateNotification } = useSubscriptionsStore.getState();

      setGames((prevGames) => {
        const index = prevGames.findIndex(g => g.id === updatedGame.id);
        const oldGame = index !== -1 ? prevGames[index] : null;

        if (oldGame) {
          // Перевірити зміну статусу для підписаних користувачів
          if (isSubscribed(updatedGame.id) &&
              oldGame.status === 'planned' &&
              updatedGame.status !== 'planned') {

            const statusText = updatedGame.status === 'completed'
              ? 'Завершено'
              : updatedGame.status === 'in-progress'
                ? 'Ранній доступ'
                : updatedGame.status;

            addNotification({
              type: 'status-change',
              gameId: updatedGame.id,
              gameName: updatedGame.name,
              oldValue: 'Заплановано',
              newValue: statusText,
            });
          }

          // Перевірити оновлення версії (для всіх ігор, не тільки підписаних)
          if (oldGame.version && updatedGame.version &&
              oldGame.version !== updatedGame.version) {
            addVersionUpdateNotification(
              updatedGame.id,
              updatedGame.name,
              oldGame.version,
              updatedGame.version
            );
          }
        }

        // Перевірити чи гра відповідає поточному фільтру пошуку
        const matchesSearch = !searchQuery ||
          updatedGame.name.toLowerCase().includes(searchQuery.toLowerCase());

        // Перевірити чи гра відповідає поточному фільтру статусу
        const matchesFilter = filter === 'all' ||
          (filter === 'completed' && updatedGame.status === 'completed') ||
          (filter === 'in-progress' && updatedGame.status === 'in-progress') ||
          (filter === 'planned' && updatedGame.status === 'planned');

        // Перевірити adult фільтр
        const matchesAdult = showAdultGames || !updatedGame.is_adult;

        const shouldBeInList = matchesSearch && matchesFilter && matchesAdult && updatedGame.approved;

        if (index === -1) {
          // Гра не в списку
          if (!shouldBeInList) return prevGames;

          // Додати гру і відсортувати за алфавітом
          const newGames = [...prevGames, updatedGame];
          newGames.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
          setTotal(prev => prev + 1);
          return newGames;
        } else {
          // Гра є в списку
          if (!shouldBeInList) {
            // Видалити гру, якщо вона більше не відповідає фільтрам
            setTotal(prev => prev - 1);
            return prevGames.filter(g => g.id !== updatedGame.id);
          }

          // Оновити гру і пересортувати
          const newGames = [...prevGames];
          newGames[index] = updatedGame;
          newGames.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
          return newGames;
        }
      });
    };

    window.electronAPI.onGameUpdated(handleGameUpdate);
  }, [searchQuery, filter, showAdultGames]);

  // Слухати realtime видалення ігор
  useEffect(() => {
    if (!window.electronAPI?.onGameRemoved) return;

    const handleGameRemoved = (gameId: string) => {
      console.log('[useGames] Game removed via realtime:', gameId);

      // Видалити гру зі списку, якщо вона там є
      setGames((prevGames) => {
        const filtered = prevGames.filter(g => g.id !== gameId);
        if (filtered.length !== prevGames.length) {
          setTotal(prev => prev - 1);
        }
        return filtered;
      });
    };

    window.electronAPI.onGameRemoved(handleGameRemoved);
  }, []);

  // Слухати зміни у встановлених перекладах (install/uninstall)
  useEffect(() => {
    if (!window.electronAPI?.onInstalledGamesChanged) return;
    if (filter !== 'installed-translations') return;

    const handleInstalledGamesChanged = () => {
      console.log('[useGames] Installed translations changed, reloading list');
      loadGames();
    };

    window.electronAPI.onInstalledGamesChanged(handleInstalledGamesChanged);
  }, [filter, loadGames]);

  return {
    games,
    total,
    isLoading,
    reload,
  };
}
