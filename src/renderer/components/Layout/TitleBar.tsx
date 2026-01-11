import React, { useState, useEffect } from 'react';
import { MinimizeIcon } from '../Icons/MinimizeIcon';
import { MaximizeIcon } from '../Icons/MaximizeIcon';
import { RestoreIcon } from '../Icons/RestoreIcon';
import { CloseIcon } from '../Icons/CloseIcon';

interface TitleBarProps {
  online: boolean;
  version: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ online, version }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMacOS26Plus, setIsMacOS26Plus] = useState(false);

  // Check if running on macOS 26+ (has native window controls)
  useEffect(() => {
    window.liquidGlassAPI?.isSupported().then((supported) => {
      setIsMacOS26Plus(supported);
    });
  }, []);

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
      className={`drag-region fixed top-0 left-0 right-0 h-8 flex items-center justify-between px-4 z-[9999] ${
        online ? '' : 'bg-red-500/20'
      } transition-colors`}
    >
      {/* Hide LBK text on macOS 26+ to avoid overlap with native traffic lights */}
      {!isMacOS26Plus && <div className="text-xs text-text-muted font-medium">LBK</div>}
      {isMacOS26Plus && <div />}

      <div className="text-[10px] text-text-muted/70 absolute left-1/2 -translate-x-1/2">
        {`v${version}${online ? '' : ' · ви оффлайн'}`}
      </div>

      {/* Hide custom window controls on macOS 26+ (has native controls) */}
      {!isMacOS26Plus && (
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
      {isMacOS26Plus && <div />}
    </div>
  );
};
