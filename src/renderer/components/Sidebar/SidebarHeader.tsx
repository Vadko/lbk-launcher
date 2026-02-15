import logo from '@resources/logo.svg';
import logoDark from '@resources/logo-dark.svg';
import { useSettingsStore } from '@store/useSettingsStore';
import { useStore } from '@store/useStore';
import { Home } from 'lucide-react';
import React, { useSyncExternalStore } from 'react';

interface SidebarHeaderProps {
  isCompact?: boolean;
}

const subscribeToMediaQuery = (callback: () => void) => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
};

const getSystemDarkMode = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

export const SidebarHeader: React.FC<SidebarHeaderProps> = React.memo(
  ({ isCompact = false }) => {
    const { setSelectedGame } = useStore();
    const { theme } = useSettingsStore();
    const systemDarkMode = useSyncExternalStore(
      subscribeToMediaQuery,
      getSystemDarkMode,
      () => true
    );
    const isDarkTheme = theme === 'system' ? systemDarkMode : theme === 'dark';
    return (
      <div
        className={`relative flex items-center gap-3 select-none overflow-visible ${
          isCompact ? '' : 'border-b p-3 pl-4 border-border'
        }`}
      >
        <img
          src={isDarkTheme ? logo : logoDark}
          alt="LBK logo"
          className={isCompact ? 'w-16 h-8 object-cover' : 'w-20 h-14  object-cover'}
          draggable={false}
        />
        {!isCompact && (
          <>
            <div className="flex-1"></div>
            <button
              onClick={() => setSelectedGame(null)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-main hover:bg-white/10 active:scale-95 transition-all"
              title="Відкрити головну сторінку"
            >
              <Home size={20} />
            </button>
          </>
        )}
      </div>
    );
  }
);
