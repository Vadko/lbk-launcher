import React, { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useDeepLink } from '../hooks/useDeepLink';
import { useGamepadModeNavigation } from '../hooks/useGamepadModeNavigation';
import { useNavigateFromNotifications } from '../hooks/useNavigateFromNotifications';
import { GamePage } from '../pages/GamePage';
import { HomePage } from '../pages/HomePage';

interface AppRoutesProps {
  isGamepadMode: boolean;
}

/**
 * Компонент для налаштування маршрутів та хуків навігації
 * Викликає хуки, які потребують Router context
 */
export const AppRoutes: React.FC<AppRoutesProps> = ({ isGamepadMode }) => {
  // Обробка deep link для навігації до перекладу
  useDeepLink();

  // Обробка навігації з системних нотифікацій
  useNavigateFromNotifications();

  // Геймпад навігація (потребує Router context)
  useGamepadModeNavigation(isGamepadMode);

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game/:gameId" element={<GamePage />} />
      </Routes>
    </Suspense>
  );
};
