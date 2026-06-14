import logo from '@resources/logo.svg';
import { useStore } from '@store/useStore';
import { Home, Newspaper } from 'lucide-react';
import React from 'react';

interface SidebarHeaderProps {
  isCompact?: boolean;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = React.memo(
  ({ isCompact = false }) => {
    const { setSelectedGame, setMainPageView } = useStore();

    const openNews = () => {
      setSelectedGame(null);
      setMainPageView('news');
    };

    const openMainPage = () => {
      setSelectedGame(null);
      setMainPageView('main');
    };
    return (
      <div
        className={`relative flex items-center justify-between gap-3 select-none overflow-visible ${
          isCompact ? '' : 'border-b p-3 pl-4 border-border'
        }`}
      >
        <img
          src={logo}
          alt="LBK logo"
          className={isCompact ? 'w-16 h-8 object-cover' : 'w-20 h-14  object-cover'}
          draggable={false}
        />
        {!isCompact && (
          <div className="flex items-center gap-2">
            <button
              onClick={openNews}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-main hover:bg-white/10 active:scale-95 transition-all"
              title="Відкрити новини"
            >
              <Newspaper size={20} />
            </button>
            <button
              onClick={openMainPage}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-main hover:bg-white/10 active:scale-95 transition-all"
              title="Відкрити головну сторінку"
            >
              <Home size={20} />
            </button>
          </div>
        )}
      </div>
    );
  }
);
