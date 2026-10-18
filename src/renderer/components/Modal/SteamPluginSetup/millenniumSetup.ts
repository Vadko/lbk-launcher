import { match, P } from 'ts-pattern';
import type {
  MillenniumInstallResult,
  MillenniumUnsupportedReason,
  PluginHostState,
  SteamBridgeStatus,
} from '@/shared/plugin-host-types';
import { millenniumOffer } from '../../../utils/pluginHostOffer';
import { restartFailureMessage } from '../../../utils/steamBridge';
import {
  hostOs,
  millenniumFailureText,
  millenniumUnsupportedText,
} from '../../../utils/steamPluginHost';

export const DONE_TEXT =
  'Millennium встановлено. Steam підключився до лаунчера через плагін «LBK Bridge».';
export const OFFLINE_DONE_TEXT =
  'Millennium встановлено. Плагін «LBK Bridge» підключиться, щойно ви запустите Steam.';
const QUEUED_TEXT =
  'Millennium встановиться, щойно ви закриєте Steam. Якщо лаунчер на той момент буде закритий — під час його наступного запуску, коли Steam не працюватиме.';
const MAC_QUEUED_TEXT = 'Потім запускайте Steam з лаунчера або через «Steam Millennium».';
export const STEAM_NOT_BACK_TEXT =
  'Steam не запустився після встановлення Millennium. Можливо, ця версія Millennium ще не підтримує ваш Steam.';
export const ENV_MISSING_TEXT =
  'Steam запущено не з лаунчера, тому Millennium не активний. Перезапустіть Steam з лаунчера або повторно увійдіть у систему.';
export const EXTERNAL_TEXT =
  'Millennium уже встановлено — лаунчер сам додасть до нього плагін «LBK Bridge».';

export type RestartChoice = 'now' | 'on-exit';

export const isPluginConnected = (status: SteamBridgeStatus | null): boolean =>
  status?.millennium.plugin.connected === true;

export type ErrorActions =
  | 'retry'
  | 'site'
  | 'steam-not-back'
  | 'env-missing'
  | 'recheck'
  | 'none';

export type SetupResult =
  | { kind: 'done'; paragraphs: string[] }
  | { kind: 'error'; message: string; actions: ErrorActions };

export const setupDone = (paragraphs: string[]): SetupResult => ({
  kind: 'done',
  paragraphs,
});
export const setupError = (message: string, actions: ErrorActions): SetupResult => ({
  kind: 'error',
  message,
  actions,
});

export function queuedParagraphs(): string[] {
  return hostOs() === 'macos' ? [QUEUED_TEXT, MAC_QUEUED_TEXT] : [QUEUED_TEXT];
}

export function failureStep(
  result: MillenniumInstallResult,
  unsupportedReason: MillenniumUnsupportedReason | null
): SetupResult {
  return match(result)
    .returnType<SetupResult>()
    .with({ reason: 'unsupported', error: 'external' }, () =>
      setupError(EXTERNAL_TEXT, 'none')
    )
    .with({ reason: 'unsupported' }, () =>
      setupError(millenniumUnsupportedText(unsupportedReason), 'none')
    )
    .with({ reason: 'not-writable' }, ({ reason }) =>
      setupError(millenniumFailureText(reason), 'site')
    )
    .with({ reason: P.union('conflict', 'busy') }, ({ reason }) =>
      setupError(millenniumFailureText(reason), 'none')
    )
    .with({ reason: 'files-locked' }, ({ reason }) =>
      setupDone([millenniumFailureText(reason)])
    )
    .with({ reason: 'restart-failed', restartReason: 'launch-failed' }, () =>
      setupError(STEAM_NOT_BACK_TEXT, 'steam-not-back')
    )
    .with({ reason: 'restart-failed' }, ({ restartReason, error, queued }) => {
      const text = restartFailureMessage(restartReason, error, false);
      return setupError(queued ? `${text}\n\n${QUEUED_TEXT}` : text, 'none');
    })
    .with(
      {
        reason: P.optional(
          P.union(
            'download-failed',
            'checksum-mismatch',
            'extract-failed',
            'av-blocked',
            'not-prepared',
            'script-failed',
            'cancelled',
            'plugin-not-connected'
          )
        ),
      },
      ({ reason }) => setupError(millenniumFailureText(reason), 'retry')
    )
    .exhaustive();
}

export function restartBlockedNote(status: SteamBridgeStatus | null): string | null {
  if (status?.steamElevated) {
    return restartFailureMessage('access-denied', undefined, false);
  }
  return status?.gamescope ? restartFailureMessage('gamescope', undefined, false) : null;
}

export type IntroMode =
  | 'loading'
  | 'offer'
  | 'update'
  | 'repair'
  | 'pending'
  | 'external'
  | 'unsupported';

export function introMode(state: PluginHostState | null): IntroMode {
  if (!state) {
    return 'loading';
  }
  if (state.millennium.pending === 'activate') {
    return 'pending';
  }
  const offer = millenniumOffer(state);
  switch (offer.kind) {
    case 'managed':
      if (offer.needsRepair) {
        return 'repair';
      }
      return offer.update !== null ? 'update' : 'external';
    case 'external':
      return 'external';
    case 'installable':
      return 'offer';
    case 'unavailable':
      return 'unsupported';
  }
}
