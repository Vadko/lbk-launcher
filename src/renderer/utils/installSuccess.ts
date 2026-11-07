import { t } from '@/shared/i18n/i18n';
import type { AchievementsDelivery, SteamBridgeStatus } from '@/shared/plugin-host-types';
import type { Game } from '@/shared/types';
import type { ModalAction } from '../store/useModalStore';
import { useResourcesStore } from '../store/useResourcesStore';
import { deckyPluginDisabled, type OfferTarget, successOffer } from './pluginHostOffer';
import { runSteamRestart } from './steamBridge';
import { millenniumUnsupportedText } from './steamPluginHost';

export interface InstallSuccessInput {
  launchOptionsQueued: boolean;
  launchOptionsError?: string;
  eglLaunchOptionsNotes?: string[];
  // Undefined when the achievements component was not installed.
  delivery: AchievementsDelivery | undefined;
  // Fetched once, and only when needsBridgeStatus() asks for it; null falls back to the last status main pushed.
  status: SteamBridgeStatus | null;
  declined: { millennium: boolean; decky: boolean };
}

interface InstallSuccessHandlers {
  restart: () => void;
  open: (target: OfferTarget) => void;
}

// A failed fetch answers null, which would drop the reason LBK cannot install Millennium here.
function bridgeStatus(input: InstallSuccessInput): SteamBridgeStatus | null {
  return input.status ?? useResourcesStore.getState().values.steamBridgeStatus ?? null;
}

// With no status at all the reason is unknown, so the install is offered only when a status allows it.
function millenniumInstallable(status: SteamBridgeStatus | null): boolean {
  return status !== null && status.achievements.unsupportedReason === null;
}

const DELIVERY_TEXT: Record<
  AchievementsDelivery,
  (status: SteamBridgeStatus | null) => string | null
> = {
  'plugin-live': () => null,
  'plugin-next-start': () => t('installSuccess.pluginNextStart'),
  'needs-millennium': (status) =>
    millenniumInstallable(status)
      ? t('installSuccess.needsMillenniumInstallable')
      : t('installSuccess.needsMillennium'),
  'needs-decky-plugin': (status) =>
    deckyPluginDisabled(status?.decky ?? null)
      ? t('installSuccess.deckyPluginDisabled')
      : t('installSuccess.needsDeckyPlugin'),
  'needs-decky': () => t('installSuccess.needsDecky'),
  unavailable: (status) =>
    t('installSuccess.unavailable', {
      reason: millenniumUnsupportedText(status?.achievements.unsupportedReason ?? null),
    }),
  disabled: () => t('installSuccess.disabled'),
};

function restartHelps(
  input: Pick<InstallSuccessInput, 'delivery' | 'launchOptionsQueued'>
) {
  return input.launchOptionsQueued || input.delivery === 'plugin-next-start';
}

// 'plugin-next-start' already asks for this restart, and the other deliveries have no plugin connected.
function bridgeUpdatePending(
  delivery: AchievementsDelivery | undefined,
  status: SteamBridgeStatus | null
): boolean {
  return (
    delivery === 'plugin-live' && status?.millennium.plugin.updateAfterRestart === true
  );
}

export function needsBridgeStatus(
  input: Pick<InstallSuccessInput, 'delivery' | 'launchOptionsQueued'>
): boolean {
  return (
    restartHelps(input) ||
    input.delivery === 'plugin-live' ||
    input.delivery === 'needs-millennium' ||
    input.delivery === 'needs-decky-plugin' ||
    input.delivery === 'unavailable'
  );
}

export function installSuccessMessage(base: string, input: InstallSuccessInput): string {
  const status = bridgeStatus(input);
  const deliveryText = input.delivery ? DELIVERY_TEXT[input.delivery](status) : null;
  const paragraphs = [
    base,
    input.launchOptionsQueued ? t('installSuccess.launchOptionsQueued') : null,
    ...(input.eglLaunchOptionsNotes ?? []),
    // Files are in place, but without its launch options the translation runs unmodded.
    input.launchOptionsError
      ? t('installSuccess.launchOptionsError', { error: input.launchOptionsError })
      : null,
    deliveryText,
    bridgeUpdatePending(input.delivery, status) ? t('pluginEntries.bridgeUpdate') : null,
  ];
  return paragraphs.filter((paragraph) => paragraph !== null).join('\n\n');
}

export function installSuccessActions(
  input: InstallSuccessInput,
  handlers: InstallSuccessHandlers
): ModalAction[] {
  const status = bridgeStatus(input);
  const actions: ModalAction[] = [
    { label: t('installSuccess.ok'), onClick: () => undefined, variant: 'primary' },
  ];
  if (
    (restartHelps(input) || bridgeUpdatePending(input.delivery, status)) &&
    status?.canRestartSteam === true
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
        millenniumInstallable: millenniumInstallable(status),
        deckyPluginDisabled: deckyPluginDisabled(status?.decky ?? null),
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
