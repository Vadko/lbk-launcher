// Window interface extensions for Electron APIs
interface LiquidGlassAPI {
  isSupported: () => Promise<boolean>;
  toggle: (enabled: boolean) => Promise<void>;
}

interface LoggerAPI {
  openLogsFolder: () => Promise<{ success: boolean; error?: string }>;
  log: (level: string, message: string, ...args: unknown[]) => void;
}

interface API {
  logError: (message: string, stack: string) => void;
  clearCacheOnly: () => Promise<{ success: boolean; error?: string }>;
  clearAllData: () => Promise<{ success: boolean; error?: string }>;
}

interface StoreStorageAPI {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

// showSystemNotification and onNavigateToGame merge in from src/shared/game-link-target.ts
interface WindowControlsAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => void;
  isVisible: () => Promise<boolean>;
}

interface Window {
  liquidGlassAPI: LiquidGlassAPI;
  loggerAPI: LoggerAPI;
  api: API;
  storeStorage: StoreStorageAPI;
  windowControls: WindowControlsAPI;
}
