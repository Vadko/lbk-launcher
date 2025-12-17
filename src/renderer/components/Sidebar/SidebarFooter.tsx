import React from 'react';
import { Settings, Bell, Monitor } from 'lucide-react';

interface SidebarFooterProps {
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  unreadCount: number;
  isCompact?: boolean;
  onSwitchToDesktop?: () => void;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = React.memo(
  ({ onOpenHistory, onOpenSettings, unreadCount, isCompact = false, onSwitchToDesktop }) => (
    <div className={`flex gap-2 ${isCompact ? '' : 'pt-3 border-t border-border p-4'}`}>
      {isCompact && onSwitchToDesktop && (
        <button
          onClick={onSwitchToDesktop}
          data-nav-group="sidebar-actions"
          data-gamepad-header-item
          className="p-2 glass-button rounded-xl hover:bg-glass-hover transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-neon-blue"
          title="Десктопний режим"
        >
          <Monitor size={20} className="mx-auto text-text-muted" />
        </button>
      )}
      <button
        onClick={onOpenHistory}
        data-nav-group="sidebar-actions"
        data-gamepad-header-item={isCompact ? true : undefined}
        className={`relative glass-button rounded-xl hover:bg-glass-hover transition-all duration-300 ${isCompact ? 'p-2 focus:outline-none focus:ring-2 focus:ring-neon-blue' : 'flex-1 p-3'}`}
        title="Сповіщення"
      >
        <Bell size={20} className="mx-auto text-text-muted" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] px-1 h-4 bg-neon-blue text-bg-dark text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      <button
        onClick={onOpenSettings}
        data-nav-group="sidebar-actions"
        data-gamepad-header-item={isCompact ? true : undefined}
        className={`glass-button rounded-xl hover:bg-glass-hover transition-all duration-300 ${isCompact ? 'p-2 focus:outline-none focus:ring-2 focus:ring-neon-blue' : 'flex-1 p-3'}`}
        title="Налаштування"
      >
        <Settings size={20} className="mx-auto text-text-muted" />
      </button>
    </div>
  )
);
