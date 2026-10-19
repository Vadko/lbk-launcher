import { match, P } from 'ts-pattern';
import { t } from '@/shared/i18n/i18n';
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
  return hostOs() === 'macos'
    ? [t('millenniumSetup.queued'), t('millenniumSetup.macQueued')]
    : [t('millenniumSetup.queued')];
}

export function restartFailedText(
  { restartReason, error, queued }: MillenniumInstallResult,
  queuedText: string
): string {
  const text = restartFailureMessage(restartReason, error, false);
  return queued ? `${text}\n\n${queuedText}` : text;
}

export function failureStep(
  result: MillenniumInstallResult,
  unsupportedReason: MillenniumUnsupportedReason | null
): SetupResult {
  return match(result)
    .returnType<SetupResult>()
    .with({ reason: 'unsupported', error: 'external' }, () =>
      setupError(t('millenniumSetup.external'), 'none')
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
      setupError(t('millenniumSetup.steamNotBack'), 'steam-not-back')
    )
    .with({ reason: 'restart-failed' }, (failure) =>
      setupError(restartFailedText(failure, t('millenniumSetup.queued')), 'none')
    )
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
