import { t } from '@/shared/i18n/i18n';
import type {
  AchievementsDelivery,
  MillenniumUnsupportedReason,
  SteamBridgeStatus,
} from '@/shared/plugin-host-types';
import type { Game } from '@/shared/types';
import type { ModalAction } from '../store/useModalStore';
import { type OfferTarget, successOffer } from './pluginHostOffer';
import { runSteamRestart } from './steamBridge';
import { millenniumUnsupportedText } from './steamPluginHost';

export interface InstallSuccessInput {
  launchOptionsQueued: boolean;
  launchOptionsError?: string;
  // Undefined when the achievements component was not installed.
  delivery: AchievementsDelivery | undefined;
  // Fetched once, and only when needsBridgeStatus() asks for it.
  status: SteamBridgeStatus | null;
  declined: { millennium: boolean; decky: boolean };
}

interface InstallSuccessHandlers {
  restart: () => void;
  open: (target: OfferTarget) => void;
}

const DELIVERY_TEXT: Record<
  AchievementsDelivery,
  (reason: MillenniumUnsupportedReason | null) => string
> = {
  'plugin-live': () => '',
  'plugin-next-start': () => `\n\n${t('installSuccess.pluginNextStart')}`,
  'needs-millennium': (reason) =>
    reason === null
      ? `\n\n${t('installSuccess.needsMillenniumInstallable')}`
      : `\n\n${t('installSuccess.needsMillennium')}`,
  'needs-decky-plugin': () => `\n\n${t('installSuccess.needsDeckyPlugin')}`,
  'needs-decky': () => `\n\n${t('installSuccess.needsDecky')}`,
  unavailable: (reason) =>
    `\n\n${t('installSuccess.unavailable', { reason: millenniumUnsupportedText(reason) })}`,
  disabled: () => `\n\n${t('installSuccess.disabled')}`,
};

function restartHelps(
  input: Pick<InstallSuccessInput, 'delivery' | 'launchOptionsQueued'>
) {
  return input.launchOptionsQueued || input.delivery === 'plugin-next-start';
}

// 'plugin-next-start' already asks for this restart, and the other deliveries have no plugin connected.
function bridgeUpdatePending(input: InstallSuccessInput): boolean {
  return (
    input.delivery === 'plugin-live' &&
    input.status?.millennium.plugin.updateAfterRestart === true
  );
}

export function needsBridgeStatus(
  input: Pick<InstallSuccessInput, 'delivery' | 'launchOptionsQueued'>
): boolean {
  return (
    restartHelps(input) ||
    input.delivery === 'plugin-live' ||
    input.delivery === 'needs-millennium' ||
    input.delivery === 'unavailable'
  );
}

function unsupportedReason(
  input: InstallSuccessInput
): MillenniumUnsupportedReason | null {
  return input.status?.achievements.unsupportedReason ?? null;
}

export function installSuccessMessage(base: string, input: InstallSuccessInput): string {
  let message = base;
  if (input.launchOptionsQueued) {
    message += `\n\n${t('installSuccess.launchOptionsQueued')}`;
  }
  // Files are in place, but without its launch options the translation runs unmodded.
  if (input.launchOptionsError) {
    message += `\n\n${t('installSuccess.launchOptionsError', { error: input.launchOptionsError })}`;
  }
  if (input.delivery) {
    message += DELIVERY_TEXT[input.delivery](unsupportedReason(input));
  }
  if (bridgeUpdatePending(input)) {
    message += `\n\n${t('pluginEntries.bridgeUpdate')}`;
  }
  return message;
}

export function installSuccessActions(
  input: InstallSuccessInput,
  handlers: InstallSuccessHandlers
): ModalAction[] {
  const actions: ModalAction[] = [
    { label: t('installSuccess.ok'), onClick: () => undefined, variant: 'primary' },
  ];
  if (
    (restartHelps(input) || bridgeUpdatePending(input)) &&
    input.status?.canRestartSteam === true
  ) {
    actions.push({
      label: t('installSuccess.restartSteamNow'),
      onClick: handlers.restart,
      keepOpen: true,
      variant: 'secondary',
    });
  }
  const offer = input.delivery
    ? successOffer(input.delivery, {
        millenniumInstallable: unsupportedReason(input) === null,
        declined: input.declined,
      })
    : null;
  if (offer) {
    actions.push({
      label: offer.label,
      onClick: () => handlers.open(offer.target),
      keepOpen: offer.external,
      variant: 'secondary',
    });
  }
  return actions;
}

// Queued launch options are written in the restart gap, so that restart reports on them.
export function restartSteamAfterInstall(game: Game, launchOptionsQueued: boolean): void {
  if (launchOptionsQueued) {
    void runSteamRestart(() => window.electronAPI.applyPendingLaunchOptions(game), {
      launchOptions: true,
      failureTitle: t('installSuccess.restartFailureTitle'),
      successTitle: t('installSuccess.restartSuccessTitle'),
      successMessage: t('installSuccess.restartSuccessMessage'),
    });
    return;
  }
  void runSteamRestart(() => window.electronAPI.restartSteam(), { launchOptions: false });
}
