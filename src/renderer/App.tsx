import React, { useEffect, useState } from 'react';
import { Minimize2, Maximize2, X } from 'lucide-react';
import { AmbientBackground } from './components/Layout/AmbientBackground';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MainContent } from './components/MainContent/MainContent';
import { UpdateNotification } from './components/UpdateNotification/UpdateNotification';
import { GameUpdateNotification } from './components/GameUpdateNotification/GameUpdateNotification';
import { GlobalModal } from './components/Modal/GlobalModal';
import { ConfirmModal } from './components/Modal/ConfirmModal';
import { SettingsModal } from './components/Settings/SettingsModal';
import { useStore } from './store/useStore';
import { useSettingsStore } from './store/useSettingsStore';

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
  const { fetchGames, initRealtimeSubscription, loadInstalledGames, setInitialLoadComplete } = useStore();
  const { animationsEnabled } = useSettingsStore();
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const init = async () => {
      await fetchGames();
      await loadInstalledGames();
      initRealtimeSubscription();
      // Mark initial load as complete after 3 seconds to allow system notifications
      setTimeout(() => {
        setInitialLoadComplete();
      }, 3000);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOnlineEvent = () => {
    setOnline(true);
  };
  const handleOfflineEvent = () => {
    setOnline(false);
  };

  useEffect(() => {
    window.addEventListener('online', handleOnlineEvent);
    window.addEventListener('offline', handleOfflineEvent);

    return () => {
      window.removeEventListener('online', handleOnlineEvent);
      window.removeEventListener('offline', handleOfflineEvent);
    };
  }, []);

  const handleMinimize = () => {
    window.windowControls?.minimize();
  };

  const handleMaximize = () => {
    window.windowControls?.maximize();
  };

  const handleClose = () => {
    window.windowControls?.close();
  };

  return (
    <div className={`relative w-screen h-screen bg-bg-dark text-white ${!animationsEnabled ? 'no-animations' : ''}`}>
      <AmbientBackground />

      {/* Title bar */}
      <div
        className={`drag-region fixed top-0 left-0 right-0 h-8 flex items-center justify-between px-4 z-50 ${online ? '' : 'bg-red-500/20'} transition-colors`}
      >
        <div className="text-xs text-text-muted font-medium">Little Bit</div>
        <div className="text-[10px] text-text-muted/50 absolute left-1/2 -translate-x-1/2">
          {`v${window.electronAPI?.getVersion?.() || ''}${online ? '' : ' · ви оффлайн'}`}
        </div>
        <div className="no-drag flex gap-2">
          <button
            onClick={handleMinimize}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-glass-hover transition-colors"
          >
            <Minimize2 size={14} />
          </button>
          <button
            onClick={handleMaximize}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-glass-hover transition-colors"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex h-full pt-8">
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
