import React, { useEffect } from 'react';
import { MainPage } from '../components/MainContent/MainPage';
import { useStore } from '../store/useStore';

/**
 * Launcher home page
 * Shows InstalledGamesSection, NewGamesSection, TrendGamesSection
 */
export const HomePage: React.FC = () => {
  const setSelectedGame = useStore((state) => state.setSelectedGame);

  // Clear the selected game when navigating to the home page
  // This prevents the animation from the previous game to the new one
  useEffect(() => {
    setSelectedGame(null);
  }, [setSelectedGame]);

  return <MainPage />;
};
