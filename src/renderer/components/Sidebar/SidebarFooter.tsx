import { Bell, Home, Settings, Volume2, VolumeX } from 'lucide-react';
import React from 'react';
import { useStore } from '@/renderer/store/useStore';
import { useSettingsStore } from '../../store/useSettingsStore';

interface SidebarFooterProps {
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  unreadCount: number;
  isCompact?: boolean;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = React.memo(
  ({ onOpenHistory, onOpenSettings, unreadCount, isCompact = false }) => {
    const { gamepadSoundsEnabled, toggleGamepadSounds } = useSettingsStore();
    const { setSelectedGame } = useStore();

    return (
      <div className={`flex gap-2 ${isCompact ? '' : 'pt-3 border-t border-border p-4'}`}>
        {isCompact && (
          <>
            <button
              onClick={() => setSelectedGame(null)}
              data-nav-group="sidebar-actions"
              data-gamepad-header-item
              className="p-2 glass-button rounded-xl hover:bg-glass-hover transition-all duration-300"
              title="Відкрити головну сторінку"
            >
              <Home size={20} className="mx-auto text-text-muted" />
            </button>
            <button
              onClick={toggleGamepadSounds}
              data-nav-group="sidebar-actions"
              data-gamepad-header-item
              className="p-2 glass-button rounded-xl hover:bg-glass-hover transition-all duration-300"
              title={
                gamepadSoundsEnabled
                  ? 'Вимкнути звуки геймпада'
                  : 'Увімкнути звуки геймпада'
              }
            >
              {gamepadSoundsEnabled ? (
                <Volume2 size={20} className="mx-auto text-text-muted" />
              ) : (
                <VolumeX size={20} className="mx-auto text-text-muted opacity-50" />
              )}
            </button>
          </>
        )}
        <button
          onClick={onOpenHistory}
          data-nav-group="sidebar-actions"
          data-gamepad-header-item={isCompact ? true : undefined}
          className={`relative glass-button rounded-xl hover:bg-glass-hover transition-all duration-300 ${isCompact ? 'p-2' : 'flex-1 p-3'}`}
          title="Сповіщення"
        >
          <Bell size={20} className="mx-auto text-text-muted" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] px-1 h-4 bg-color-accent text-bg-dark text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={onOpenSettings}
          data-nav-group="sidebar-actions"
          data-gamepad-header-item={isCompact ? true : undefined}
          className={`glass-button rounded-xl hover:bg-glass-hover transition-all duration-300 ${isCompact ? 'p-2' : 'flex-1 p-3'}`}
          title="Налаштування"
        >
          <Settings size={20} className="mx-auto text-text-muted" />
        </button>
      </div>
    );
  }
);
