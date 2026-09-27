import { Bell, BellRing, Volume2, VolumeX } from 'lucide';
import { BookOpenText, Home, Medal, Newspaper, Settings } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../../store/useSettingsStore';
import { AppActionIcon } from '../ui/AppActionIcon';
import { AppNumberFlow } from '../ui/AppNumberFlow';

interface SidebarFooterProps {
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  unreadCount: number;
  isCompact?: boolean;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = React.memo(
  ({ onOpenHistory, onOpenSettings, unreadCount, isCompact = false }) => {
    const navigate = useNavigate();
    const { gamepadSoundsEnabled, toggleGamepadSounds } = useSettingsStore();

    return (
      <div className={`flex gap-2 ${isCompact ? '' : 'pt-3 border-t border-border p-4'}`}>
        {isCompact && (
          <>
            <button
              onClick={() => navigate('/site/guides&tools')}
              data-nav-group="sidebar-actions"
              data-gamepad-header-item
              className="p-2 glass-button rounded-xl hover:bg-glass-hover transition-all duration-300"
              title="Відкрити посібники та інструменти"
            >
              <BookOpenText size={20} className="mx-auto text-text-muted" />
            </button>
            <button
              onClick={() => navigate('/site/donaters')}
              data-nav-group="sidebar-actions"
              data-gamepad-header-item
              className="p-2 glass-button rounded-xl hover:bg-glass-hover transition-all duration-300"
              title="Відкрити сторінку донаторів"
            >
              <Medal size={20} className="mx-auto text-text-muted" />
            </button>
            <button
              onClick={() => navigate('/news')}
              data-nav-group="sidebar-actions"
              data-gamepad-header-item
              className="p-2 glass-button rounded-xl hover:bg-glass-hover transition-all duration-300"
              title="Відкрити новини"
            >
              <Newspaper size={20} className="mx-auto text-text-muted" />
            </button>
            <button
              onClick={() => navigate('/')}
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
              className="p-2 flex items-center justify-center glass-button rounded-xl hover:bg-glass-hover transition-all duration-300"
              title={
                gamepadSoundsEnabled
                  ? 'Вимкнути звуки геймпада'
                  : 'Увімкнути звуки геймпада'
              }
            >
              <AppActionIcon
                phase="idle"
                icon={gamepadSoundsEnabled ? Volume2 : VolumeX}
                size={20}
                className={`text-text-muted transition-opacity ${gamepadSoundsEnabled ? '' : 'opacity-50'}`}
              />
            </button>
          </>
        )}
        <button
          onClick={onOpenHistory}
          data-nav-group="sidebar-actions"
          data-gamepad-header-item={isCompact ? true : undefined}
          className={`relative flex items-center justify-center glass-button rounded-xl hover:bg-glass-hover transition-all duration-300 ${isCompact ? 'p-2' : 'flex-1 p-3'}`}
          title="Сповіщення"
        >
          <AppActionIcon
            phase="idle"
            icon={unreadCount > 0 ? BellRing : Bell}
            size={20}
            className="text-text-muted"
          />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] px-1 h-4 bg-color-accent text-text-dark text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
              <AppNumberFlow
                value={Math.min(unreadCount, 9)}
                suffix={unreadCount > 9 ? '+' : undefined}
              />
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
