import React, { useEffect } from 'react';
import { MainPage } from '../components/MainContent/MainPage';
import { useStore } from '../store/useStore';

/**
 * Головна сторінка лаунчера
 * Показує InstalledGamesSection, NewGamesSection, TrendGamesSection
 */
export const HomePage: React.FC = () => {
  const setSelectedGame = useStore((state) => state.setSelectedGame);

  // Очищаємо вибрану гру при переході на головну сторінку
  // Це запобігає анімації від попередньої гри до нової
  useEffect(() => {
    setSelectedGame(null);
  }, [setSelectedGame]);

  return <MainPage />;
};
