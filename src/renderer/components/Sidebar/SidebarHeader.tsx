import React from 'react';
import logo from '../../../../resources/icon.png';

interface SidebarHeaderProps {
  isCompact?: boolean;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = React.memo(
  ({ isCompact = false }) => (
    <div
      className={`flex items-center gap-3 select-none ${
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
        <div>
          <h1 className="text-lg font-head font-bold text-white">LB</h1>
          <p className="text-xs text-text-muted">Українізатори ігор</p>
        </div>
      )}
    </div>
  )
);
