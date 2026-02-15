import logo from '@resources/logo.svg';
import { useStore } from '@store/useStore';
import { Home } from 'lucide-react';
import React from 'react';

interface SidebarHeaderProps {
  isCompact?: boolean;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = React.memo(
  ({ isCompact = false }) => {
    const { setSelectedGame } = useStore();
    return (
      <div
        className={`relative flex items-center gap-3 select-none overflow-visible ${
          isCompact ? '' : 'border-b p-3 pl-4 border-border'
        }`}
      >
        <img
          src={logo}
          alt="LBK logo"
          className={isCompact ? 'w-8 h-8' : 'w-14 h-14'}
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
