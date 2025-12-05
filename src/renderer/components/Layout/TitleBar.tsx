import React from 'react';
import { MinimizeIcon } from '../Icons/MinimizeIcon';
import { MaximizeIcon } from '../Icons/MaximizeIcon';
import { CloseIcon } from '../Icons/CloseIcon';

interface TitleBarProps {
  online: boolean;
  version: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ online, version }) => {
  const handleMinimize = () => window.windowControls?.minimize();
  const handleMaximize = () => window.windowControls?.maximize();
  const handleClose = () => window.windowControls?.close();

  return (
    <div
      className={`drag-region fixed top-0 left-0 right-0 h-8 flex items-center justify-between px-4 z-50 ${
        online ? '' : 'bg-red-500/20'
      } transition-colors`}
    >
      <div className="text-xs text-text-muted font-medium">LB</div>
      <div className="text-[10px] text-text-muted/50 absolute left-1/2 -translate-x-1/2">
        {`v${version}${online ? '' : ' · ви оффлайн'}`}
      </div>
      <div className="no-drag flex gap-2">
        <button
          onClick={handleMinimize}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-glass-hover transition-colors"
        >
          <MinimizeIcon />
        </button>
        <button
          onClick={handleMaximize}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-glass-hover transition-colors"
        >
          <MaximizeIcon />
        </button>
        <button
          onClick={handleClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 transition-colors"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
};
