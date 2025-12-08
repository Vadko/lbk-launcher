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
import { NotificationModal } from './components/Notifications/NotificationModal';
import { useStore } from './store/useStore';
import { useSettingsStore } from './store/useSettingsStore';
import { useRealtimeGames } from './hooks/useRealtimeGames';
import { useGamepadNavigation } from './hooks/useGamepadNavigation';


export const App: React.FC = () => {
  const { setInitialLoadComplete, detectInstalledGames, loadSteamGames, clearSteamGamesCache, clearInstalledGamesCache, clearDetectedGamesCache } = useStore();
  const { animationsEnabled, autoDetectInstalledGames, theme, liquidGlassEnabled } = useSettingsStore();
  const [online, setOnline] = useState(navigator.onLine);
  const [liquidGlassSupported, setLiquidGlassSupported] = useState(false);
  const [showNotificationHistory, setShowNotificationHistory] = useState(false);

  // Підписка на real-time оновлення ігор
  useRealtimeGames();

  // Підтримка навігації геймпадом (для Steam Deck та інших контролерів)
  useGamepadNavigation(true);

  // Apply liquid glass effect
  useEffect(() => {
    const checkAndApplyLiquidGlass = async () => {
      if (window.liquidGlassAPI) {
        const isSupported = await window.liquidGlassAPI.isSupported();
        setLiquidGlassSupported(isSupported);
        console.log('[LiquidGlass] Support check:', { isSupported, liquidGlassEnabled });
        if (isSupported && liquidGlassEnabled) {
          console.log('[LiquidGlass] Adding liquid-glass-enabled class to body');
          document.body.classList.add('liquid-glass-enabled');
        } else {
          console.log('[LiquidGlass] Removing liquid-glass-enabled class from body');
          document.body.classList.remove('liquid-glass-enabled');
        }
      } else {
        console.warn('[LiquidGlass] liquidGlassAPI not available');
      }
    };

    checkAndApplyLiquidGlass();
  }, [liquidGlassEnabled]);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'system') {
      // Detect system preference
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const appliedTheme = isDark ? 'dark' : 'light';
      root.setAttribute('data-theme', appliedTheme);
      console.log('[Theme] Applied system theme:', appliedTheme);

      // Listen for changes in system theme
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        const newTheme = e.matches ? 'dark' : 'light';
        root.setAttribute('data-theme', newTheme);
        console.log('[Theme] System theme changed to:', newTheme);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      root.setAttribute('data-theme', theme);
      console.log('[Theme] Applied theme:', theme);
    }
  }, [theme]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoadComplete();
    }, 3000);
    return () => clearTimeout(timer);
  }, [setInitialLoadComplete]);

  // Завантажити Steam ігри при старті
  useEffect(() => {
    if (!window.electronAPI) return;

    const timer = setTimeout(async () => {
      await loadSteamGames();
    }, 1000);

    return () => clearTimeout(timer);
  }, [loadSteamGames]);

  // Детекція встановлених ігор на початку (якщо увімкнено)
  useEffect(() => {
    if (!autoDetectInstalledGames || !window.electronAPI) return;

    const runDetection = async () => {
      // Отримати всі ігри з локальної бази
      const result = await window.electronAPI.fetchGames();
      if (result.games.length === 0) {
        console.log('[App] No games in database yet, skipping initial detection');
        return;
      }
      console.log('[App] Running initial game detection for', result.games.length, 'games');
      await detectInstalledGames(result.games);
    };

    const timer = setTimeout(runDetection, 1000);
    return () => clearTimeout(timer);
  }, [autoDetectInstalledGames, detectInstalledGames]);

  // Слухати зміни Steam бібліотеки
  useEffect(() => {
    if (!window.electronAPI) return;

    const handleSteamLibraryChange = async () => {
      console.log('[App] Steam library changed, clearing cache and reloading');

      // Очистити кеші (installedGames НЕ очищаємо - це переклади, вони персістентні в installation-cache/)
      clearSteamGamesCache();
      clearDetectedGamesCache();

      // Перезавантажити Steam ігри
      await loadSteamGames();

      // Якщо увімкнено автодетекцію - перезапустити її
      if (autoDetectInstalledGames) {
        const result = await window.electronAPI.fetchGames();
        if (result.games.length > 0) {
          await detectInstalledGames(result.games);
        }
      }
    };

    window.electronAPI.onSteamLibraryChanged?.(handleSteamLibraryChange);
  }, [autoDetectInstalledGames, detectInstalledGames, loadSteamGames, clearSteamGamesCache, clearDetectedGamesCache]);

  // Слухати зміни встановлених перекладів
  useEffect(() => {
    if (!window.electronAPI) return;

    const handleInstalledGamesChange = () => {
      console.log('[App] Installed games cache changed, clearing cache');

      // Очистити кеш встановлених ігор в store
      clearInstalledGamesCache();
    };

    window.electronAPI.onInstalledGamesChanged?.(handleInstalledGamesChange);
  }, [clearInstalledGamesCache]);

  const handleOnlineEvent = () => {
    setOnline(true);
    console.log('[App] Internet connection restored');
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

  // Слухати зміни стану maximize для прибирання border-radius
  useEffect(() => {
    window.windowControls?.onMaximizedChange((isMaximized) => {
      if (isMaximized) {
        document.documentElement.classList.add('maximized');
      } else {
        document.documentElement.classList.remove('maximized');
      }
    });
  }, []);

  // Check if liquid glass mode is active (supported AND enabled)
  const isLiquidGlassActive = liquidGlassSupported && liquidGlassEnabled;

  return (
    <div className={`relative w-screen h-screen text-white ${!animationsEnabled ? 'no-animations' : ''} ${isLiquidGlassActive ? '' : 'bg-bg-dark'}`}>
      {/* Only show ambient background when liquid glass is not active */}
      {!isLiquidGlassActive && <AmbientBackground />}
      <TitleBar online={online} version={window.electronAPI?.getVersion?.() || ''} />

      {/* Main layout */}
      <div className="flex h-full pt-8 px-2 pb-2 gap-2">
        <Sidebar onOpenHistory={() => setShowNotificationHistory(true)} />
        <MainContent />
      </div>

      {/* Update notifications */}
      <UpdateNotification />
      <GameUpdateNotification />

      {/* Global modals */}
      <GlobalModal />
      <ConfirmModal />
      <SettingsModal />
      <NotificationModal
        isOpen={showNotificationHistory}
        onClose={() => setShowNotificationHistory(false)}
      />
    </div>
  );
};
