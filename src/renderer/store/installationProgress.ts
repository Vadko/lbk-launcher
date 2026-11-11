import type {
  DownloadProgress,
  InstallationStatusTone,
  InstallOptions,
} from '../../shared/types';

// Status lines the renderer sets, kept as keys so the line follows a language switch
type LocalInstallStatus =
  | 'installNetwork.waiting'
  | 'installNetwork.resuming'
  | 'installComponents.removing'
  | 'installSteamIntegration.artwork'
  | 'installSteamIntegration.artworkRevert'
  | 'download.paused'
  | 'download.resuming';

// What a download cut off by the network is retried with once the connection is back
interface NetworkRetry {
  customGamePath?: string;
  options: InstallOptions;
  autoRetried: boolean;
}

export interface InstallationProgress {
  isInstalling: boolean;
  isUninstalling: boolean;
  isPaused: boolean;
  isWaitingForNetwork: boolean;
  progress: number;
  downloadProgress: DownloadProgress | null;
  // Main's own status line, already translated
  statusMessage: string | null;
  statusKey: LocalInstallStatus | null;
  statusTone: InstallationStatusTone | null;
  networkRetry: NetworkRetry | null;
}
