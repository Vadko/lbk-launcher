import { create } from 'zustand';

export interface AppUpdateInfo {
  version?: string;
  downloadUrl?: string;
}

interface AppUpdateStore {
  isAvailable: boolean;
  isDownloaded: boolean;
  isDownloading: boolean;
  progress: number;
  info: AppUpdateInfo | null;
  // The version already added to the notification history in this run
  notifiedVersion: string | null;
  showAvailable: (info: AppUpdateInfo) => void;
  setNotifiedVersion: (version: string) => void;
  setDownloaded: () => void;
  setProgress: (percent: number) => void;
  failDownload: () => void;
  download: () => Promise<void>;
  dismiss: () => void;
}

export const useAppUpdateStore = create<AppUpdateStore>((set, get) => ({
  isAvailable: false,
  isDownloaded: false,
  isDownloading: false,
  progress: 0,
  info: null,
  notifiedVersion: null,

  showAvailable: (info) => set({ isAvailable: true, info }),
  setNotifiedVersion: (notifiedVersion) => set({ notifiedVersion }),
  setDownloaded: () => set({ isDownloaded: true, isDownloading: false }),
  setProgress: (percent) => set({ progress: Math.round(percent) }),
  failDownload: () => set({ isDownloading: false }),

  download: async () => {
    if (get().isDownloading) {
      return;
    }
    set({ isDownloading: true });
    await window.electronAPI.downloadUpdate().catch((error: unknown) => {
      console.error('[Store] Update download failed:', error);
      set({ isDownloading: false });
    });
  },

  dismiss: () => set({ isAvailable: false }),
}));
