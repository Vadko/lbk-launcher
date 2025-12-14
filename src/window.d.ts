// Window interface extensions for Electron APIs
interface LiquidGlassAPI {
  isSupported: () => Promise<boolean>;
  toggle: (enabled: boolean) => Promise<void>;
}

interface LoggerAPI {
  setEnabled: (enabled: boolean) => Promise<{ success: boolean }>;
  isEnabled: () => Promise<boolean>;
  openLogsFolder: () => Promise<{ success: boolean; error?: string }>;
  log: (level: string, message: string, ...args: unknown[]) => void;
}

interface Window {
  liquidGlassAPI: LiquidGlassAPI;
  loggerAPI: LoggerAPI;
  windowControls: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    onMaximizedChange: (callback: (isMaximized: boolean) => void) => void;
    isVisible: () => Promise<boolean>;
    showSystemNotification: (options: {
      title: string;
      body: string;
    }) => Promise<boolean>;
    clearCacheAndRestart: () => Promise<{ success: boolean; error?: string }>;
  };
}
