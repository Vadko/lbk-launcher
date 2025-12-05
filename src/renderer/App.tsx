import React, { useEffect, useState } from 'react';
import { AmbientBackground } from './components/Layout/AmbientBackground';
import { TitleBar } from './components/Layout/TitleBar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MainContent } from './components/MainContent/MainContent';
import { UpdateNotification } from './components/UpdateNotification/UpdateNotification';
import { GameUpdateNotification } from './components/GameUpdateNotification/GameUpdateNotification';
import { GlobalModal } from './components/Modal/GlobalModal';
import { ConfirmModal } from './components/Modal/ConfirmModal';
import { SettingsModal } from './components/Settings/SettingsModal';
import { useStore } from './store/useStore';
import { useSettingsStore } from './store/useSettingsStore';
import { useRealtimeGames } from './hooks/useRealtimeGames';
import { useQueryClient } from '@tanstack/react-query';
import { GAMES_QUERY_KEY } from './hooks/useGamesQuery';

declare global {
  interface Window {
    windowControls?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
  }
}

export const App: React.FC = () => {
  const { setInitialLoadComplete, detectInstalledGames } = useStore();
  const { animationsEnabled, autoDetectInstalledGames } = useSettingsStore();
  const [online, setOnline] = useState(navigator.onLine);
  const queryClient = useQueryClient();

  // Підписка на real-time оновлення ігор
  useRealtimeGames();

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoadComplete();
    }, 3000);
    return () => clearTimeout(timer);
  }, [setInitialLoadComplete]);

  // Допоміжна функція для отримання всіх ігор з кешу
  const getCachedGames = () => {
    const cachedData = queryClient.getQueryData<{ pages: { games: any[] }[] }>([GAMES_QUERY_KEY]);
    if (!cachedData) return [];
    return cachedData.pages.flatMap(page => page.games);
  };

  // Детекція встановлених ігор на початку (якщо увімкнено)
  useEffect(() => {
    if (!autoDetectInstalledGames || !window.electronAPI) return;

    const runDetection = async () => {
      const allGames = getCachedGames();
      if (allGames.length === 0) {
        console.log('[App] No cached data yet, skipping initial detection');
        return;
      }
      console.log('[App] Running initial game detection for', allGames.length, 'games');
      await detectInstalledGames(allGames);
    };

    const timer = setTimeout(runDetection, 1000);
    return () => clearTimeout(timer);
  }, [autoDetectInstalledGames, detectInstalledGames, queryClient]);

  // Слухати зміни Steam бібліотеки
  useEffect(() => {
    if (!autoDetectInstalledGames || !window.electronAPI) return;

    const handleSteamLibraryChange = async () => {
      console.log('[App] Steam library changed, re-running game detection');
      const allGames = getCachedGames();
      if (allGames.length > 0) {
        await detectInstalledGames(allGames);
      }
    };

    window.electronAPI.onSteamLibraryChanged?.(handleSteamLibraryChange);
  }, [autoDetectInstalledGames, detectInstalledGames, queryClient]);

  const handleOnlineEvent = () => {
    setOnline(true);
    // Коли інтернет повертається - перезавантажити дані
    console.log('[App] Internet connection restored, refetching data');
    queryClient.refetchQueries({ queryKey: [GAMES_QUERY_KEY] });
  };

  const handleOfflineEvent = () => {
    setOnline(false);
    console.log('[App] Internet connection lost');
  };

  useEffect(() => {
    window.addEventListener('online', handleOnlineEvent);
    window.addEventListener('offline', handleOfflineEvent);

    return () => {
      window.removeEventListener('online', handleOnlineEvent);
      window.removeEventListener('offline', handleOfflineEvent);
    };
  }, []);

  return (
    <div className={`relative w-screen h-screen bg-bg-dark text-white ${!animationsEnabled ? 'no-animations' : ''}`}>
      <AmbientBackground />
      <TitleBar online={online} version={window.electronAPI?.getVersion?.() || ''} />

      {/* Main layout */}
      <div className="flex h-full pt-8 px-2 pb-2 gap-2">
        <Sidebar />
        <MainContent />
      </div>

      {/* Update notifications */}
      <UpdateNotification />
      <GameUpdateNotification />

      {/* Global modals */}
      <GlobalModal />
      <ConfirmModal />
      <SettingsModal />
    </div>
  );
};
