import { useEffect } from 'react';
import { NewsFeedSection } from '../components/MainContent/NewsFeedSection';
import { useGamepadModeStore } from '../store/useGamepadModeStore';
import { useStore } from '../store/useStore';

/**
 * Launcher news page
 * Shows NewsFeedSection
 */
export function NewsPage() {
  const setSelectedGame = useStore((state) => state.setSelectedGame);
  const isGamepadMode = useGamepadModeStore((state) => state.isGamepadMode);

  // Clear the selected game when navigating to the news page
  // This prevents the animation from the previous game to the new one
  useEffect(() => {
    setSelectedGame(null);
  }, [setSelectedGame]);

  return (
    <div
      data-gamepad-main-content
      className={`flex-1 grid grid-cols-1 justify-items-center items-start px-8 ${isGamepadMode ? 'py-4' : ''} overflow-y-auto justify-center custom-scrollbar`}
    >
      <div
        className={`main-page grid grid-rows-auto grid-cols-1 gap-10 h-auto w-full max-w-[1564px]`}
      >
        <NewsFeedSection />
      </div>
    </div>
  );
}
