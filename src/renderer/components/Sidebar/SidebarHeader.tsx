import React from 'react';
import logo from '../../../../resources/icon.png';

interface SidebarHeaderProps {
  isCompact?: boolean;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = React.memo(
  ({ isCompact = false }) => {
    return (
      <div
        className={`relative flex items-center gap-3 select-none overflow-visible ${
          isCompact ? '' : 'pb-3 border-b p-4 border-border'
        }`}
      >
        <img
          src={logo}
          alt="LB logo"
          className={isCompact ? 'w-8 h-8' : 'w-12 h-12'}
          draggable={false}
        />
        {!isCompact && (
          <div className="flex-1">
            <h1 className="text-lg font-head font-bold text-text-main">LB</h1>
            <p className="text-xs text-text-muted">Українізатори ігор</p>
          </div>
        )}
      </div>
    );
  }
);
