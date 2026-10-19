import type {
  AchievementsDelivery,
  MillenniumUnsupportedReason,
  SteamBridgeStatus,
} from '@/shared/plugin-host-types';
import type { Game } from '@/shared/types';
import type { ModalAction } from '../store/useModalStore';
import { BRIDGE_UPDATE_TEXT } from './pluginHostEntries';
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
  'plugin-next-start': () =>
    "\n\nПереклад досягнень з'явиться після наступного запуску Steam.",
  'needs-millennium': (reason) =>
    reason === null
      ? '\n\nПереклад досягнень збережено. Щоб бачити його в Steam, потрібен Millennium — лаунчер може встановити його сам.'
      : '\n\nПереклад досягнень збережено. Щоб бачити його в Steam, потрібен Millennium.',
  'needs-decky-plugin': () =>
    '\n\nПереклад досягнень збережено. Щоб бачити його в Steam, встановіть плагін «LBK Bridge» для Decky Loader.',
  'needs-decky': () =>
    '\n\nПереклад досягнень збережено. На Steam Deck його показує плагін «LBK Bridge» для Decky Loader — лаунчер може встановити Decky Loader сам.',
  unavailable: (reason) =>
    `\n\nПереклад досягнень збережено, але на цій системі Steam не може його показати: ${millenniumUnsupportedText(reason)}`,
  disabled: () =>
    '\n\nПереклад досягнень збережено. Щоб бачити його в Steam, увімкніть у налаштуваннях «Швидке застосування параметрів запуску Steam».',
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
    message +=
      '\n\nПараметри запуску застосуються автоматично, щойно ви закриєте Steam. Лаунчер має бути відкритим — його можна згорнути в трей.';
  }
  // Files are in place, but without its launch options the translation runs unmodded.
  if (input.launchOptionsError) {
    message += `\n\nНе вдалося налаштувати параметри запуску Steam: ${input.launchOptionsError}`;
  }
  if (input.delivery) {
    message += DELIVERY_TEXT[input.delivery](unsupportedReason(input));
  }
  if (bridgeUpdatePending(input)) {
    message += `\n\n${BRIDGE_UPDATE_TEXT}`;
  }
  return message;
}

export function installSuccessActions(
  input: InstallSuccessInput,
  handlers: InstallSuccessHandlers
): ModalAction[] {
  const actions: ModalAction[] = [
    { label: 'Зрозуміло', onClick: () => undefined, variant: 'primary' },
  ];
  if (
    (restartHelps(input) || bridgeUpdatePending(input)) &&
    input.status?.canRestartSteam === true
  ) {
    actions.push({
      label: 'Перезапустити Steam зараз',
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
      failureTitle: 'Параметри запуску не застосовано',
      successTitle: 'Параметри запуску застосовано',
      successMessage: 'Параметри запуску записано. Можна запускати гру.',
    });
    return;
  }
  void runSteamRestart(() => window.electronAPI.restartSteam(), { launchOptions: false });
}
