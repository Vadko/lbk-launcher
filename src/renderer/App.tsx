import React, { useEffect, useState } from 'react';
import { AmbientBackground } from './components/Layout/AmbientBackground';
import { TitleBar } from './components/Layout/TitleBar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MainContent } from './components/MainContent/MainContent';
import { UpdateNotification } from './components/UpdateNotification/UpdateNotification';
import { ToastNotifications } from './components/Notifications/ToastNotifications';
import { GlobalModal } from './components/Modal/GlobalModal';
import { ConfirmModal } from './components/Modal/ConfirmModal';
import { SettingsModal } from './components/Settings/SettingsModal';
import { NotificationModal } from './components/Notifications/NotificationModal';
import { GamepadHints } from './components/GamepadHints/GamepadHints';
import { ChristmasEffects } from './components/ChristmasEffects/ChristmasEffects';
import { useStore } from './store/useStore';
import { useSettingsStore } from './store/useSettingsStore';
import { useGamepadModeStore } from './store/useGamepadModeStore';
import { useRealtimeGames } from './hooks/useRealtimeGames';
import { useGamepadModeNavigation } from './hooks/useGamepadModeNavigation';
import { useDeepLink } from './hooks/useDeepLink';

export const App: React.FC = () => {
  const {
    setInitialLoadComplete,
    detectInstalledGames,
    loadSteamGames,
    clearSteamGamesCache,
    clearDetectedGamesCache,
  } = useStore();
  const { animationsEnabled, autoDetectInstalledGames, theme, liquidGlassEnabled } =
    useSettingsStore();
  const { isGamepadMode, setGamepadMode, navigationArea, userDisabledGamepadMode, setUserDisabledGamepadMode } = useGamepadModeStore();
  const [online, setOnline] = useState(navigator.onLine);
  const [liquidGlassSupported, setLiquidGlassSupported] = useState(false);
  const [showNotificationHistory, setShowNotificationHistory] = useState(false);

  // Підписка на real-time оновлення ігор
  useRealtimeGames();

  // Обробка deep link для навігації до перекладу
  useDeepLink();

  // Простий скрол геймпадом (тільки в геймпад-режимі)
  useGamepadModeNavigation(isGamepadMode);

  
  // Auto-enable gamepad mode when gamepad is connected
  useEffect(() => {
    const handleGamepadConnected = () => {
      console.log('[App] Gamepad connected');
      if (!isGamepadMode && !userDisabledGamepadMode) {
        setGamepadMode(true);
      }
    };

    const handleGamepadDisconnected = () => {
      console.log('[App] Gamepad disconnected');
      const gamepads = navigator.getGamepads();
      const stillConnected = !!(gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3]);

      if (!stillConnected) {
        if (isGamepadMode) {
          setGamepadMode(false);
        }
        // Reset user preference when gamepad disconnected
        setUserDisabledGamepadMode(false);
      }
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
    };
  }, [setGamepadMode, isGamepadMode, userDisabledGamepadMode, setUserDisabledGamepadMode]);

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
    } 
      root.setAttribute('data-theme', theme);
      console.log('[Theme] Applied theme:', theme);
    
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
      console.log(
        '[App] Running initial game detection for',
        result.games.length,
        'games'
      );
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

      // Очистити кеші (installedGames НЕ очищаємо - це українізатори, вони персістентні в installation-cache/)
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

    const unsubscribe = window.electronAPI.onSteamLibraryChanged?.(
      handleSteamLibraryChange
    );
    return unsubscribe;
  }, [
    autoDetectInstalledGames,
    detectInstalledGames,
    loadSteamGames,
    clearSteamGamesCache,
    clearDetectedGamesCache,
  ]);

  // Слухати зміни встановлених українізаторів
  // Цей listener потрібен для всіх змін: інсталяція, деінсталяція, зовнішні зміни
  useEffect(() => {
    if (!window.electronAPI?.onInstalledGamesChanged) return;

    const handleInstalledGamesChanged = () => {
      console.log('[App] Installed games changed, reloading from system');
      // Use getState() to avoid dependency on the function reference
      useStore.getState().loadInstalledGamesFromSystem();
    };

    const unsubscribe = window.electronAPI.onInstalledGamesChanged(
      handleInstalledGamesChanged
    );
    return unsubscribe;
  }, []);

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
    <div
      className={`relative w-screen h-screen text-white ${!animationsEnabled ? 'no-animations' : ''} ${isLiquidGlassActive ? '' : 'bg-bg-dark'}`}
      data-gamepad-mode={isGamepadMode || undefined}
    >
      {/* Only show ambient background when liquid glass is not active */}
      {!isLiquidGlassActive && <AmbientBackground />}
      <TitleBar online={online} version={window.electronAPI?.getVersion?.() || ''} />
      <ChristmasEffects />

      {/* Main layout - changes based on gamepad mode */}
      {isGamepadMode ? (
        /* Gamepad layout: Header + Games strip on top, MainContent below */
        <div className="flex flex-col h-full pt-8">
          {/* Sidebar - hides when in main-content mode */}
          <div
            className={`transition-all duration-300 ease-in-out relative z-20 ${
              navigationArea === 'main-content'
                ? 'max-h-0 opacity-0 overflow-hidden'
                : 'max-h-[300px] opacity-100'
            }`}
          >
            <Sidebar
              onOpenHistory={() => setShowNotificationHistory(true)}
              isHorizontal={true}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <MainContent />
          </div>
        </div>
      ) : (
        /* Normal layout: Vertical sidebar on left, MainContent on right */
        <div className="flex h-full pt-8 px-2 pb-2 gap-2">
          <Sidebar
            onOpenHistory={() => setShowNotificationHistory(true)}
            isHorizontal={false}
          />
          <MainContent />
        </div>
      )}

      {/* Update notifications */}
      <UpdateNotification />
      <ToastNotifications />

      {/* Global modals */}
      <GlobalModal />
      <ConfirmModal />
      <SettingsModal />
      <NotificationModal
        isOpen={showNotificationHistory}
        onClose={() => setShowNotificationHistory(false)}
      />

      {/* Gamepad hints */}
      <GamepadHints />
    </div>
  );
};
