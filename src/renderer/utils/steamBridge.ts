import { errorMessage } from '@/shared/errors';
import type { RestartFailureReason, SteamBridgeStatus } from '@/shared/plugin-host-types';
import { plural } from '@/shared/plural';
import { useModalStore } from '../store/useModalStore';

const MILLENNIUM_URL = 'https://steambrew.app';

export function openMillenniumSite(): void {
  window.electronAPI?.openExternal?.(MILLENNIUM_URL).catch((error: unknown) => {
    console.warn('[SteamBridge] Opening the Millennium site failed:', error);
  });
}

const CEF_BLOCKED_TEXT =
  'Steam не відкрив канал для лаунчера навіть після перезапуску, тож лаунчер більше не проситиме перезапускати Steam. Параметри запуску застосовуватимуться після закриття Steam. Можливо, канал блокує інший мод Steam.';

function millenniumPendingText(status: SteamBridgeStatus): string {
  const { millennium } = status;
  if (!millennium.detected) {
    return 'Steam не відкрив канал для лаунчера. Параметри запуску застосовуватимуться після закриття Steam. Можливо, канал блокує інший мод Steam.';
  }
  if (!millennium.plugin.supported) {
    return 'Виявлено Millennium, але лаунчер не зміг додати до нього плагін «LBK Bridge». Параметри запуску застосовуватимуться після закриття Steam.';
  }
  if (millennium.plugin.enabled) {
    return 'Плагін «LBK Bridge» для Millennium увімкнено, але Steam ще не завантажив його. Плагін запрацює після наступного запуску Steam.';
  }
  return 'Виявлено Millennium. Він закриває канал, через який лаунчер працює зі Steam, тому лаунчер встановив плагін «LBK Bridge» для Millennium. Плагін увімкнеться автоматично, щойно ви закриєте Steam. Або увімкніть його вже зараз: налаштування Millennium → Plugins → LBK Bridge.';
}

export function steamBridgeStatusText(status: SteamBridgeStatus): string | null {
  switch (status.code) {
    case 'ok':
      if (status.transport !== 'plugin') {
        return 'Підключено до Steam.';
      }
      return status.pluginHost === 'decky'
        ? 'Підключено до Steam через плагін «LBK Bridge» для Decky.'
        : 'Підключено до Steam через плагін «LBK Bridge» для Millennium.';
    case 'steam-not-running':
      return 'Steam не запущено.';
    case 'restart-pending':
      return 'Щоб увімкнути швидке застосування, перезапустіть Steam один раз.';
    case 'cef-blocked':
      return CEF_BLOCKED_TEXT;
    case 'millennium-plugin-pending':
      return millenniumPendingText(status);
    case 'millennium-outdated':
      return 'Виявлено застарілий Millennium 2.x. Оновіть Millennium до версії 3 — тоді лаунчер зможе працювати з ним через плагін. До того параметри запуску застосовуватимуться після закриття Steam.';
    default:
      return null;
  }
}

export function pendingLaunchOptionsText(count: number): string {
  return `Очікують закриття Steam: параметри запуску для ${count} ${plural(count, 'гри', 'ігор', 'ігор')}.`;
}

export function restartFailureMessage(
  reason: RestartFailureReason | undefined,
  error: string | undefined,
  launchOptions: boolean
): string {
  switch (reason) {
    case 'access-denied':
      return launchOptions
        ? 'Steam запущено від імені адміністратора, тому лаунчер не може його перезапустити. Закрийте Steam самостійно — параметри запуску застосуються автоматично.'
        : 'Steam запущено від імені адміністратора, тому лаунчер не може його перезапустити. Перезапустіть Steam самостійно.';
    case 'gamescope':
      return launchOptions
        ? 'В ігровому режимі лаунчер не перезапускає Steam. Параметри запуску застосуються, щойно Steam буде закрито — наприклад, після переходу в режим робочого столу.'
        : 'В ігровому режимі лаунчер не перезапускає Steam. Перезапустіть його самостійно — наприклад, перейдіть у режим робочого столу.';
    case 'game-running':
      return launchOptions
        ? 'Закрийте гру, щоб перезапустити Steam. Параметри запуску застосуються, щойно Steam буде закрито.'
        : 'Закрийте гру, щоб перезапустити Steam.';
    case 'timeout':
      return launchOptions
        ? 'Steam не закрився вчасно. Закрийте його вручну — параметри запуску застосуються автоматично.'
        : 'Steam не закрився вчасно. Перезапустіть його вручну.';
    case 'launch-failed':
      return 'Steam закрито, але не вдалося запустити його знову. Запустіть Steam вручну.';
    default:
      return error ?? 'Не вдалося перезапустити Steam.';
  }
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

// Shows progress while Steam restarts, then the outcome; the progress modal is replaced, never stacked.
export async function runSteamRestart(
  action: () => Promise<SteamRestartOutcome>,
  options: RunSteamRestartOptions
): Promise<void> {
  const modal = useModalStore.getState();
  const progress = {
    title: 'Перезапуск Steam',
    message: 'Лаунчер закриває і знову запускає Steam. Це може тривати до двох хвилин.',
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
      error: errorMessage(error, 'Невідома помилка'),
    };
  }

  if (!outcome.success) {
    showOutcome({
      title: outcome.reason
        ? 'Steam не перезапущено'
        : (options.failureTitle ?? 'Steam не перезапущено'),
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
      title: 'Steam перезапущено',
      message: text ?? CEF_BLOCKED_TEXT,
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
