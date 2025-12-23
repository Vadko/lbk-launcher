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

interface API {
  logError: (message: string, stack: string) => void;
  clearCacheOnly: () => Promise<{ success: boolean; error?: string }>;
  clearAllData: () => Promise<{ success: boolean; error?: string }>;
  clearCache: () => Promise<{ success: boolean; error?: string }>; // Legacy
}

interface Window {
  liquidGlassAPI: LiquidGlassAPI;
  loggerAPI: LoggerAPI;
  api: API;
  windowControls: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    onMaximizedChange: (callback: (isMaximized: boolean) => void) => void;
    isVisible: () => Promise<boolean>;
    showSystemNotification: (options: {
      title: string;
      body: string;
      gameId?: string;
    }) => Promise<boolean>;
    onNavigateToGame: (callback: (gameId: string) => void) => () => void;
    clearCacheAndRestart: () => Promise<{ success: boolean; error?: string }>;
  };
}
