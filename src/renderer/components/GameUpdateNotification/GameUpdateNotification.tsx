import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';

interface GameUpdateInfo {
  gameName: string;
  version: string;
}

export const GameUpdateNotification: React.FC = () => {
  const { gameUpdateNotificationsEnabled } = useSettingsStore();
  const [updates, setUpdates] = useState<GameUpdateInfo[]>([]);

  useEffect(() => {
    const handleGameUpdate = (updateInfo: GameUpdateInfo) => {
      // Only show notification if enabled
      if (!gameUpdateNotificationsEnabled) return;

      setUpdates((prev) => {
        // Check if this update is already in the list
        if (prev.some((u) => u.gameName === updateInfo.gameName)) {
          return prev;
        }
        return [...prev, updateInfo];
      });

      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        setUpdates((prev) => prev.filter((u) => u.gameName !== updateInfo.gameName));
      }, 10000);
    };

    // Listen for game update notifications via custom event
    const listener = ((event: CustomEvent<GameUpdateInfo>) => {
      handleGameUpdate(event.detail);
    }) as EventListener;

    window.addEventListener('game-update-available', listener);

    return () => {
      window.removeEventListener('game-update-available', listener);
    };
  }, [gameUpdateNotificationsEnabled]);

  const dismissUpdate = (gameName: string) => {
    setUpdates((prev) => prev.filter((u) => u.gameName !== gameName));
  };

  if (!gameUpdateNotificationsEnabled || updates.length === 0) return null;

  return (
    <div className="fixed top-12 right-4 z-50 flex flex-col gap-2">
      {updates.map((update) => (
        <div
          key={update.gameName}
          className="bg-glass border border-neon-blue backdrop-blur-xl rounded-xl p-4 shadow-lg min-w-[320px] animate-in slide-in-from-right"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center flex-shrink-0">
              <Download size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-white mb-1">
                Доступне оновлення
              </h4>
              <p className="text-xs text-text-muted">
                {update.gameName} • версія {update.version}
              </p>
            </div>
            <button
              onClick={() => dismissUpdate(update.gameName)}
              className="flex-shrink-0 w-6 h-6 rounded-lg hover:bg-glass-hover transition-colors flex items-center justify-center"
            >
              <X size={14} className="text-text-muted" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
