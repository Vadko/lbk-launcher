import React, { useEffect } from 'react';
import { NewsFeedSection } from '../components/MainContent/NewsFeedSection';
import { useGamepadModeStore } from '../store/useGamepadModeStore';
import { useStore } from '../store/useStore';

/**
 * Cторінка новин лаунчера
 * Показує NewsFeedSection
 */
export const NewsPage: React.FC = () => {
  const setSelectedGame = useStore((state) => state.setSelectedGame);

  // Очищаємо вибрану гру при переході на сторінку новин
  // Це запобігає анімації від попередньої гри до нової
  useEffect(() => {
    setSelectedGame(null);
  }, [setSelectedGame]);

  return (
    <div
      data-gamepad-main-content
      className={`flex-1 grid grid-cols-1 justify-items-center items-start px-8 ${useGamepadModeStore.getState().isGamepadMode && 'py-4'} overflow-y-auto justify-center custom-scrollbar`}
    >
      <div
        className={`main-page grid grid-rows-auto grid-cols-1 gap-10 h-auto w-full max-w-[1317px]`}
      >
        <NewsFeedSection />
      </div>
    </div>
  );
};
