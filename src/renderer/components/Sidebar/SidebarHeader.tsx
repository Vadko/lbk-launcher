import logo from '@resources/logo.svg';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MENU_BUTTONS } from './constants';

interface SidebarHeaderProps {
  isCompact?: boolean;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = React.memo(
  ({ isCompact = false }) => {
    const navigate = useNavigate();
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
          <div className="flex items-center gap-1">
            {MENU_BUTTONS.map((button) => (
              <button
                key={button.id}
                onClick={() => navigate(button.path)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-main hover:bg-white/10 active:scale-95 transition-all"
                title={button.title}
              >
                <button.icon size={20} />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);
