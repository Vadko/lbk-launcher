import type { ChangelogEntry } from './types';

export interface UpdaterAPI {
  checkForUpdates: () => Promise<{
    available: boolean;
    updateInfo?: unknown;
    message?: string;
    error?: string;
  }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => void;
  onUpdateAvailable: (callback: (info: unknown) => void) => () => void;
  onUpdateDownloaded: (callback: (info: unknown) => void) => () => void;
  onUpdateProgress: (
    callback: (progress: {
      percent?: number;
      bytesPerSecond?: number;
      total?: number;
      transferred?: number;
    }) => void
  ) => () => void;
  onUpdateError: (callback: (error: Error) => void) => () => void;
  fetchChangelog: (version: string) => Promise<ChangelogEntry[] | null>;
}
