import mixpanel from 'mixpanel-browser';
import React, { useEffect, useRef, useState } from 'react';
import { Route } from 'react-router-dom';
import { Router } from '../lib/electron-router-dom';
import { MainLayout } from './components/Layout/MainLayout';
import { useIdleEffect } from './hooks/useIdleEffect';
import { useRealtimeGames } from './hooks/useRealtimeGames';
import { GamePage } from './pages/GamePage';
import { HomePage } from './pages/HomePage';
import { NewsPage } from './pages/NewsPage';
import { useGamepadModeStore } from './store/useGamepadModeStore';
import { useModalStore } from './store/useModalStore';
import { useSettingsStore } from './store/useSettingsStore';
import { useStore } from './store/useStore';
import { trackEvent } from './utils/analytics';
import { isValidGamepad } from './utils/isValidGamepad';

// Higher deadzone for mode switching to prevent accidental triggers from stick drift
const MODE_SWITCH_DEADZONE = 0.8;

const isE2E = window.electronAPI?.isE2E?.() ?? false;

if (!isE2E) {
  try {
    const mpToken = import.meta.env.DEV
      ? import.meta.env.VITE_MIXPANEL_TOKEN_DEV
      : import.meta.env.VITE_MIXPANEL_TOKEN_PROD;
    if (mpToken) {
      mixpanel.init(mpToken, {
        debug: import.meta.env.DEV,
      });
    }
  } catch (err) {
    console.error('[Analytics] mixpanel.init failed', err);
  }
}

// Реєструємо версію лаунчера як super property, щоб вона додавалась у всі івенти автоматично
(async () => {
  try {
    const version = await window.electronAPI?.getVersion?.();
    const machineId = await window.electronAPI?.getMachineId?.();
    if (version) {
      mixpanel.register({ 'Launcher Version': version });
      mixpanel.register({ 'Machine ID': machineId });
    }
  } catch (err) {
    console.error('[Analytics] mixpanel.register failed', err);
  }
})();

export const App: React.FC = () => {
  const {
    detectInstalledGames,
    loadSteamGames,
    clearSteamGamesCache,
    clearDetectedGamesCache,
    setSyncStatus,
  } = useStore();
  const { autoDetectInstalledGames, liquidGlassEnabled } = useSettingsStore();
  const setGamepadMode = useGamepadModeStore((s) => s.setGamepadMode);
  const [online, setOnline] = useState(navigator.onLine);
  const [liquidGlassSupported, setLiquidGlassSupported] = useState(false);
  const setLoaderVisible = useStore((s) => s.setLoaderVisible);

  // Підписка на real-time оновлення ігор
  useRealtimeGames();

  // Listen for sync status from main process
  useEffect(() => {
    let rafId = 0;
    let hideStarted = false;
    const loaderStartTime = performance.now();
    const MIN_LOADER_DISPLAY_MS = 1000; // Minimum time to show loader for animations
    const STABLE_FRAMES = 20;
    // 45мс покриває 24-120Hz: на 30Hz (Low Power Mode) кадр ~33мс, на 40Hz
    // (Steam Deck) ~25мс — з меншим бюджетом стрік ніколи не набирався і
    // лоадер завжди висів повні MAX_WAIT_AFTER_READY_MS
    const FRAME_BUDGET_MS = 45;
    const MAX_WAIT_AFTER_READY_MS = 8000;

    const hideLoaderWhenStable = () => {
      if (hideStarted) {
        return;
      }
      hideStarted = true;

      const readyAt = performance.now();
      let lastFrame = readyAt;
      let stableStreak = 0;

      const tick = (now: number) => {
        stableStreak = now - lastFrame <= FRAME_BUDGET_MS ? stableStreak + 1 : 0;
        lastFrame = now;

        const minShown = now - loaderStartTime >= MIN_LOADER_DISPLAY_MS;
        const timedOut = now - readyAt >= MAX_WAIT_AFTER_READY_MS;

        if ((stableStreak >= STABLE_FRAMES && minShown) || timedOut) {
          setLoaderVisible(false);
          return;
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    };

    if (!window.electronAPI?.getSyncStatus) {
      // No electron API - probably in browser, show app after minimum time
      hideLoaderWhenStable();
      return;
    }

    // Get current sync status immediately
    window.electronAPI.getSyncStatus().then((status) => {
      console.log('[App] Initial sync status:', status);
      setSyncStatus(status);
      if (status === 'ready' || status === 'error') {
        hideLoaderWhenStable();
      }
    });

    // Also listen for future status changes
    const unsubscribe = window.electronAPI.onSyncStatus((status) => {
      console.log('[App] Sync status changed:', status);
      setSyncStatus(status);
      if (status === 'ready' || status === 'error') {
        hideLoaderWhenStable();
      }
    });

    return () => {
      unsubscribe();
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [setSyncStatus, setLoaderVisible]);

  // Відстеження першого запуску додатку
  useEffect(() => {
    if (!window.storeStorage) {
      return;
    }

    const hasLaunchedBefore = window.storeStorage.getItem('has-launched-before');
    if (!hasLaunchedBefore) {
      window.storeStorage.setItem('has-launched-before', 'true');
      trackEvent('First App Open');
    }
  }, []);

  // Track mouse movement for mode switching
  const lastMouseMoveRef = useRef(0);

  // Mode switching: poll connected gamepads in a RAF loop so a first button
  // press or stick movement flips us into gamepad mode. RAF runs ONLY while
  // a gamepad is connected — without one, getGamepads() returns an empty
  // array and polling 60×/sec for nothing was burning CPU for every user.
  useEffect(() => {
    const MOUSE_THROTTLE_MS = 500;

    let rafId = 0;
    const tick = () => {
      if (!useGamepadModeStore.getState().isGamepadMode) {
        for (const pad of navigator.getGamepads()) {
          if (!pad || !pad.connected || !isValidGamepad(pad)) {
            continue;
          }
          const anyButtonPressed = pad.buttons.some((b) => b.pressed);
          const anyAxisMoved = pad.axes.some(
            (axis) => Math.abs(axis) > MODE_SWITCH_DEADZONE
          );
          if (anyButtonPressed || anyAxisMoved) {
            setGamepadMode(true);
            break;
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    const startPolling = () => {
      if (rafId) {
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    const stopPolling = () => {
      if (!rafId) {
        return;
      }
      cancelAnimationFrame(rafId);
      rafId = 0;
    };

    const handleGamepadConnected = (e: GamepadEvent) => {
      if (!isValidGamepad(e.gamepad)) {
        return;
      }
      console.log('[App] Gamepad connected:', e.gamepad.id);
      setGamepadMode(true);
      startPolling();
    };

    const handleGamepadDisconnected = (e: GamepadEvent) => {
      console.log('[App] Gamepad disconnected:', e.gamepad.id);
      const stillConnected = Array.from(navigator.getGamepads()).some(isValidGamepad);
      if (!stillConnected) {
        setGamepadMode(false);
        stopPolling();
      }
    };

    const handleMouseMove = () => {
      const now = Date.now();
      if (now - lastMouseMoveRef.current < MOUSE_THROTTLE_MS) {
        return;
      }
      lastMouseMoveRef.current = now;
      if (useGamepadModeStore.getState().isGamepadMode) {
        setGamepadMode(false);
      }
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);
    window.addEventListener('mousemove', handleMouseMove);

    // Cover the case where a gamepad was already connected before mount
    // (Chromium fires gamepadconnected on first input, not at page load).
    if (Array.from(navigator.getGamepads()).some(isValidGamepad)) {
      startPolling();
    }

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
      window.removeEventListener('mousemove', handleMouseMove);
      stopPolling();
    };
  }, [setGamepadMode]);

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

  useIdleEffect(() => {
    if (window.electronAPI) {
      loadSteamGames();
    }
  }, [loadSteamGames]);

  // Завантажити встановлені українізатори при старті
  useIdleEffect(() => {
    if (window.electronAPI) {
      useStore.getState().loadInstalledGamesFromSystem();
    }
  }, []);

  // Детекція встановлених ігор на початку (якщо увімкнено)
  useIdleEffect(async () => {
    if (!autoDetectInstalledGames || !window.electronAPI) {
      return;
    }

    // Отримати всі ігри з локальної бази
    const result = await window.electronAPI.fetchGames();
    if (result.games.length === 0) {
      console.log('[App] No games in database yet, skipping initial detection');
      return;
    }
    console.log('[App] Running initial game detection for', result.games.length, 'games');
    await detectInstalledGames(result.games);
  }, [autoDetectInstalledGames, detectInstalledGames]);

  // Слухати зміни Steam бібліотеки
  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }

    const handleSteamLibraryChange = async () => {
      console.log('[App] Steam library changed, clearing cache and reloading');

      // Очистити кеші (installedTranslations НЕ очищаємо - це українізатори, вони персістентні в installation-cache/)
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
    if (!window.electronAPI?.onInstalledGamesChanged) {
      return;
    }

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

  // [DEV ONLY] Listen for test games changes and broadcast to components
  useEffect(() => {
    if (!window.electronAPI?.onTestGamesChanged) {
      return;
    }

    const handleTestGamesChanged = () => {
      window.dispatchEvent(new Event('test-games-updated'));
    };

    const unsubscribe = window.electronAPI.onTestGamesChanged(handleTestGamesChanged);
    return unsubscribe;
  }, []);

  // Mandatory one-time "restart Steam" prompt — fires at launcher startup if
  // Steam is running but its debug channel (CEF) isn't open. We just dropped
  // the flag file Steam reads on startup; one restart enables live config
  // updates for all future installs.
  useEffect(() => {
    if (!window.electronAPI?.onSteamRestartRequired) {
      return;
    }
    const unsubscribe = window.electronAPI.onSteamRestartRequired(() => {
      useModalStore.getState().showModal({
        title: 'Перезапустіть Steam',
        message:
          'Для коректного встановлення перекладів потрібно перезапустити Steam. ' +
          'Це разова дія — наступні встановлення відбуватимуться без рестартів.',
        type: 'info',
        mandatory: true,
        actions: [
          {
            label: 'Перезапустити Steam',
            onClick: () => {
              window.electronAPI.restartSteam();
            },
            variant: 'primary',
          },
        ],
      });
    });
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

  return (
    <Router
      main={
        <Route
          path="/"
          element={
            <MainLayout
              online={online}
              version={window.electronAPI?.getVersion?.() || ''}
              liquidGlassSupported={liquidGlassSupported}
            />
          }
        >
          <Route index element={<HomePage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/game/:gameId" element={<GamePage />} />
        </Route>
      }
    />
  );
};
