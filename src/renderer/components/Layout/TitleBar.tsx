import React, { useEffect, useState } from 'react';
import { t } from '@/shared/i18n/i18n';
import { CloseIcon } from '../Icons/CloseIcon';
import { MaximizeIcon } from '../Icons/MaximizeIcon';
import { MinimizeIcon } from '../Icons/MinimizeIcon';
import { RestoreIcon } from '../Icons/RestoreIcon';

interface TitleBarProps {
  online: boolean;
  version: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ online, version }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  // macOS always shows the native traffic lights on the left instead of these controls.
  const isMacOS = window.electronAPI?.getPlatform() === 'macos';

  useEffect(() => {
    window.windowControls?.onMaximizedChange((maximized) => {
      setIsMaximized(maximized);
    });
  }, []);

  const handleMinimize = () => window.windowControls?.minimize();
  const handleMaximize = () => window.windowControls?.maximize();
  const handleClose = () => window.windowControls?.close();

  return (
    <div
      className={`drag-region fixed top-0 left-0 right-0 h-8 flex items-center justify-between pl-4 z-9999 ${
        online ? '' : 'bg-red-500/20'
      } transition-colors`}
    >
      {isMacOS ? <div /> : <div className="text-xs text-text-muted font-medium">LBK</div>}

      <div className="text-[10px] absolute left-1/2 -translate-x-1/2">
        {`v${version}${online ? '' : t('titleBar.offlineSuffix')}`}
      </div>

      {!isMacOS && (
        <div className="no-drag flex gap-1">
          <button
            onClick={handleMinimize}
            className="w-12 h-8 flex items-center justify-center text-text-muted hover:bg-white/10 hover:text-white transition-colors titlebar-btn"
          >
            <MinimizeIcon />
          </button>
          <button
            onClick={handleMaximize}
            className="w-12 h-8 flex items-center justify-center text-text-muted hover:bg-white/10 hover:text-white transition-colors titlebar-btn"
          >
            {isMaximized ? <MaximizeIcon /> : <RestoreIcon />}
          </button>
          <button
            onClick={handleClose}
            className="w-12 h-8 flex items-center justify-center text-text-muted hover:bg-red-600 hover:text-white transition-colors titlebar-close-btn"
          >
            <CloseIcon />
          </button>
        </div>
      )}
      {isMacOS && <div />}
    </div>
  );
};
