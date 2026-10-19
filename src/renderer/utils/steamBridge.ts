import { errorMessage } from '@/shared/errors';
import { t } from '@/shared/i18n/i18n';
import type { RestartFailureReason, SteamBridgeStatus } from '@/shared/plugin-host-types';
import { useModalStore } from '../store/useModalStore';

function millenniumPendingText(status: SteamBridgeStatus): string {
  const { millennium } = status;
  if (!millennium.detected) {
    return t('millenniumPending.notDetected');
  }
  if (!millennium.plugin.supported) {
    return t('millenniumPending.unsupported');
  }
  if (millennium.plugin.enabled) {
    return t('millenniumPending.enabled');
  }
  return t('millenniumPending.disabled');
}

const STATUS_TEXT: Record<
  SteamBridgeStatus['code'],
  (status: SteamBridgeStatus) => string | null
> = {
  ok: (status) => {
    if (status.transport !== 'plugin') {
      return t('bridgeStatus.connected');
    }
    return status.pluginHost === 'decky'
      ? t('bridgeStatus.connectedDecky')
      : t('bridgeStatus.connectedMillennium');
  },
  'setting-off': () => null,
  'steam-not-running': () => t('bridgeStatus.steamNotRunning'),
  'restart-pending': () => t('bridgeStatus.restartPending'),
  'cef-blocked': () => t('bridgeStatus.cefBlocked'),
  'millennium-plugin-pending': millenniumPendingText,
  'millennium-outdated': () => t('bridgeStatus.millenniumOutdated'),
};

export function steamBridgeStatusText(status: SteamBridgeStatus): string | null {
  return STATUS_TEXT[status.code](status);
}

export function pendingLaunchOptionsText(count: number): string {
  return t('pendingLaunchOptions.queued', { count });
}

const RESTART_FAILURE_TEXT: Record<
  RestartFailureReason,
  { launchOptions: string; plain: string }
> = {
  'access-denied': {
    launchOptions: t('steamRestartFailure.accessDenied.launchOptions'),
    plain: t('steamRestartFailure.accessDenied.plain'),
  },
  gamescope: {
    launchOptions: t('steamRestartFailure.gamescope.launchOptions'),
    plain: t('steamRestartFailure.gamescope.plain'),
  },
  'game-running': {
    launchOptions: t('steamRestartFailure.gameRunning.launchOptions'),
    plain: t('steamRestartFailure.gameRunning.plain'),
  },
  timeout: {
    launchOptions: t('steamRestartFailure.timeout.launchOptions'),
    plain: t('steamRestartFailure.timeout.plain'),
  },
  'launch-failed': {
    launchOptions: t('steamRestartFailure.launchFailed'),
    plain: t('steamRestartFailure.launchFailed'),
  },
};

export function restartFailureMessage(
  reason: RestartFailureReason | undefined,
  error: string | undefined,
  launchOptions: boolean
): string {
  if (reason === undefined) {
    return error ?? t('steamRestartFailure.generic');
  }
  const text = RESTART_FAILURE_TEXT[reason];
  return launchOptions ? text.launchOptions : text.plain;
}

interface SteamRestartOutcome {
  success: boolean;
  reason?: RestartFailureReason;
  bridge?: 'ready' | 'blocked' | 'unknown';
  error?: string;
}

interface RunSteamRestartOptions {
  // Copy for a restart that writes queued launch options in its gap.
  launchOptions: boolean;
  // Title for a failure that is not a restart failure (no `reason`).
  failureTitle?: string;
  successTitle?: string;
  successMessage?: string;
}

type ModalConfig = NonNullable<ReturnType<typeof useModalStore.getState>['config']>;

// The global modal has one slot: another modal opened meanwhile (an installer's mandatory run prompt) must survive.
export function mayReplaceModal(current: ModalConfig | null, own: ModalConfig): boolean {
  return current === null || current === own;
}

export function restartSteamWithStatus(status: SteamBridgeStatus | null): void {
  void runSteamRestart(() => window.electronAPI.restartSteam(), {
    launchOptions: (status?.pendingLaunchOptions.length ?? 0) > 0,
  });
}

// Shows progress while Steam restarts, then the outcome; the progress modal is replaced, never stacked.
export async function runSteamRestart(
  action: () => Promise<SteamRestartOutcome>,
  options: RunSteamRestartOptions
): Promise<void> {
  const modal = useModalStore.getState();
  const progress = {
    title: t('steamRestart.progressTitle'),
    message: t('steamRestart.progressMessage'),
    type: 'info' as const,
  };
  modal.showModal(progress);
  const showOutcome = (config: ModalConfig): void => {
    if (mayReplaceModal(useModalStore.getState().config, progress)) {
      modal.showModal(config);
      return;
    }
    window.windowControls
      ?.showSystemNotification({ title: config.title, body: config.message })
      .catch(() => undefined);
  };

  let outcome: SteamRestartOutcome;
  try {
    outcome = await action();
  } catch (error) {
    outcome = {
      success: false,
      error: errorMessage(error, t('steamRestart.unknownError')),
    };
  }

  if (!outcome.success) {
    showOutcome({
      title: outcome.reason
        ? t('steamRestart.failedTitle')
        : (options.failureTitle ?? t('steamRestart.failedTitle')),
      message: restartFailureMessage(
        outcome.reason,
        outcome.error,
        options.launchOptions
      ),
      type: 'error',
    });
    return;
  }

  if (outcome.bridge === 'blocked') {
    const status = await window.electronAPI.getSteamBridgeStatus().catch(() => null);
    const text =
      status && status.code !== 'ok' && status.code !== 'restart-pending'
        ? steamBridgeStatusText(status)
        : null;
    showOutcome({
      title: t('steamRestart.restartedTitle'),
      message: text ?? t('bridgeStatus.cefBlocked'),
      type: 'info',
    });
    return;
  }

  if (options.successTitle && options.successMessage) {
    showOutcome({
      title: options.successTitle,
      message: options.successMessage,
      type: 'success',
    });
    return;
  }

  if (useModalStore.getState().config === progress) {
    modal.closeModal();
  }
}
