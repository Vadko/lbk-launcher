import { useEffect } from 'react';
import { useStore } from '../store/useStore';

/**
 * Hook для обробки deep link навігації.
 * Слухає події deep-link від main process і навігує до потрібного перекладу.
 * URL формат: lbk://games/{slug}/{team}
 */
export function useDeepLink() {
  const setSelectedGame = useStore((state) => state.setSelectedGame);

  useEffect(() => {
    if (!window.electronAPI?.onDeepLink) return;

    const handleDeepLink = async (data: { slug: string; team: string }) => {
      console.log('[DeepLink] Navigating to:', data);

      try {
        // Завантажити всі ігри з БД
        const result = await window.electronAPI.fetchGames();

        // Знайти гру по slug та team
        const targetGame = result.games.find((game) => {
          const gameSlug = game.slug || game.id;
          const slugMatch = gameSlug === data.slug;

          // Перевіряємо team (може бути comma-separated або точний match)
          const teamMatch =
            game.team?.toLowerCase() === data.team.toLowerCase() ||
            game.team
              ?.toLowerCase()
              .split(',')
              .map((t) => t.trim())
              .includes(data.team.toLowerCase());

          return slugMatch && teamMatch;
        });

        if (targetGame) {
          console.log('[DeepLink] Found game:', targetGame.name, 'by', targetGame.team);
          setSelectedGame(targetGame);
        } else {
          console.warn('[DeepLink] Game not found for:', data);
        }
      } catch (error) {
        console.error('[DeepLink] Error handling deep link:', error);
      }
    };

    const unsubscribe = window.electronAPI.onDeepLink(handleDeepLink);
    return unsubscribe;
  }, [setSelectedGame]);
}
