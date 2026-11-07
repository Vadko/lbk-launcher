import { match } from 'ts-pattern';
import { t } from '@/shared/i18n/i18n';
import type { PluginHostState, SteamBridgeStatus } from '@/shared/plugin-host-types';
import {
  deckyOffer,
  millenniumOffer,
  type OfferAction,
  offerAction,
  updateMillenniumAction,
} from './pluginHostOffer';
import { millenniumUnsupportedText } from './steamPluginHost';

interface PluginHostLine {
  key: string;
  text: string;
}

interface PluginHostEntries {
  lines: PluginHostLine[];
  actions: OfferAction[];
}

function recommendLine(): PluginHostLine {
  return { key: 'recommend', text: t('pluginEntries.recommend') };
}

function deckyEntries(host: PluginHostState): PluginHostEntries {
  return match(deckyOffer(host))
    .returnType<PluginHostEntries>()
    .with({ kind: 'no-decky' }, ({ canInstallLoader }) => ({
      lines: [
        {
          key: 'no-decky',
          text: canInstallLoader
            ? t('pluginEntries.noDeckyCanInstall')
            : t('pluginEntries.noDecky'),
        },
      ],
      actions: canInstallLoader
        ? [offerAction('installDeckyLoader'), offerAction('deckyInfo')]
        : [offerAction('deckyInfo')],
    }))
    .with({ kind: 'plugin-disabled' }, () => ({
      lines: [{ key: 'disabled', text: t('pluginEntries.deckyPluginDisabled') }],
      actions: [],
    }))
    .with({ kind: 'plugin-missing' }, () => ({
      lines: [
        {
          key: 'decky-plugin',
          text: t('pluginEntries.deckyPlugin'),
        },
      ],
      actions: [offerAction('installDeckyPlugin')],
    }))
    .with({ kind: 'plugin-outdated' }, () => ({
      lines: [
        {
          key: 'decky-outdated',
          text: t('pluginEntries.deckyOutdated'),
        },
      ],
      actions: [offerAction('updateDeckyPlugin')],
    }))
    .with({ kind: 'plugin-ready' }, () => ({ lines: [], actions: [] }))
    .exhaustive();
}

function pendingLine(
  pending: NonNullable<PluginHostState['millennium']['pending']>
): PluginHostLine {
  return { key: `pending-${pending}`, text: t(`pluginEntries.pending.${pending}`) };
}

function millenniumEntries(host: PluginHostState): PluginHostEntries {
  const { pending } = host.millennium;
  const lines = pending ? [pendingLine(pending)] : [];
  const actions: OfferAction[] = [];
  const offer = millenniumOffer(host);

  if (offer.kind === 'managed') {
    if (offer.version && !offer.needsRepair) {
      lines.push({
        key: 'installed-version',
        text: t('pluginEntries.installedVersion', { version: offer.version }),
      });
    }
    if (offer.needsRepair) {
      lines.push({
        key: 'repair',
        text: t('pluginEntries.repair'),
      });
      actions.push(offerAction('repairMillennium'));
    } else if (offer.update) {
      lines.push({
        key: 'update',
        text: t('pluginEntries.update', { version: offer.update }),
      });
      actions.push(updateMillenniumAction(offer.update));
    }
    if (pending !== 'deactivate') {
      actions.push(offerAction('uninstallMillennium'));
    }
    return { lines, actions };
  }
  if (offer.kind === 'external' || pending) {
    return { lines, actions };
  }
  if (offer.kind === 'installable') {
    return {
      lines: [...lines, recommendLine()],
      actions: [offerAction('installMillennium'), offerAction('millenniumInfo')],
    };
  }
  if (offer.reason === null || offer.reason === 'no-release') {
    return {
      lines: [...lines, recommendLine()],
      actions: [offerAction('millenniumInfo')],
    };
  }
  return {
    lines: [
      ...lines,
      {
        key: 'unsupported',
        text: t('pluginEntries.unsupported', {
          reason: millenniumUnsupportedText(offer.reason),
        }),
      },
    ],
    actions,
  };
}

export function pluginHostEntries(
  host: PluginHostState,
  bridge: SteamBridgeStatus | null
): PluginHostEntries {
  const entries = host.host === 'decky' ? deckyEntries(host) : millenniumEntries(host);
  // Not a Millennium row: a Linux PC with Decky as the host may still run Millennium's copy.
  if (!bridge?.millennium.plugin.updateAfterRestart) {
    return entries;
  }
  return {
    lines: [
      { key: 'bridge-update', text: t('pluginEntries.bridgeUpdate') },
      ...entries.lines,
    ],
    actions: bridge.canRestartSteam
      ? [offerAction('restartSteam'), ...entries.actions]
      : entries.actions,
  };
}
