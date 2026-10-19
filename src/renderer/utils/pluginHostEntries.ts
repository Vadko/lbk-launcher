import { match } from 'ts-pattern';
import type { PluginHostState, SteamBridgeStatus } from '@/shared/plugin-host-types';
import {
  deckyOffer,
  millenniumOffer,
  OFFER_ACTIONS,
  type OfferAction,
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

export const DECKY_PLUGIN_DISABLED_TEXT =
  'Плагін «LBK Bridge» вимкнено в Decky Loader. Увімкніть його в налаштуваннях Decky.';

const RECOMMEND_LINE: PluginHostLine = {
  key: 'recommend',
  text: 'Порада: з Millennium лаунчер також показуватиме в Steam переклад досягнень.',
};

function deckyEntries(host: PluginHostState): PluginHostEntries {
  return match(deckyOffer(host))
    .returnType<PluginHostEntries>()
    .with({ kind: 'no-decky' }, ({ canInstallLoader }) => ({
      lines: [
        {
          key: 'no-decky',
          text: canInstallLoader
            ? 'Переклад досягнень у Steam показує плагін «LBK Bridge» для Decky Loader. Лаунчер може встановити Decky Loader разом із плагіном.'
            : 'Переклад досягнень у Steam показує плагін «LBK Bridge» для Decky Loader. Спершу встановіть Decky Loader.',
        },
      ],
      actions: canInstallLoader
        ? [OFFER_ACTIONS.installDeckyLoader, OFFER_ACTIONS.deckyInfo]
        : [OFFER_ACTIONS.deckyInfo],
    }))
    .with({ kind: 'plugin-disabled' }, () => ({
      lines: [{ key: 'disabled', text: DECKY_PLUGIN_DISABLED_TEXT }],
      actions: [],
    }))
    .with({ kind: 'plugin-missing' }, () => ({
      lines: [
        {
          key: 'decky-plugin',
          text: 'Плагін «LBK Bridge» для Decky Loader показує в Steam перекладені досягнення.',
        },
      ],
      actions: [OFFER_ACTIONS.installDeckyPlugin],
    }))
    .with({ kind: 'plugin-outdated' }, () => ({
      lines: [
        {
          key: 'decky-outdated',
          text: 'Доступне оновлення плагіна «LBK Bridge» для Decky.',
        },
      ],
      actions: [OFFER_ACTIONS.updateDeckyPlugin],
    }))
    .with({ kind: 'plugin-ready' }, () => ({ lines: [], actions: [] }))
    .exhaustive();
}

const PENDING_LINES: Record<'activate' | 'deactivate', PluginHostLine> = {
  activate: {
    key: 'pending-activate',
    text: 'Millennium встановиться, щойно ви закриєте Steam.',
  },
  deactivate: {
    key: 'pending-deactivate',
    text: 'Millennium буде видалено, щойно ви закриєте Steam.',
  },
};

function millenniumEntries(host: PluginHostState): PluginHostEntries {
  const { pending } = host.millennium;
  const lines = pending ? [PENDING_LINES[pending]] : [];
  const actions: OfferAction[] = [];
  const offer = millenniumOffer(host);

  if (offer.kind === 'managed') {
    if (offer.version && !offer.needsRepair) {
      lines.push({
        key: 'installed-version',
        text: `Встановлено Millennium ${offer.version}.`,
      });
    }
    if (offer.needsRepair) {
      lines.push({
        key: 'repair',
        text: 'Файли Millennium у теці Steam пошкоджено або видалено.',
      });
      actions.push(OFFER_ACTIONS.repairMillennium);
    } else if (offer.update) {
      lines.push({
        key: 'update',
        text: `Доступне оновлення Millennium: ${offer.update}.`,
      });
      actions.push(updateMillenniumAction(offer.update));
    }
    if (pending !== 'deactivate') {
      actions.push(OFFER_ACTIONS.uninstallMillennium);
    }
    return { lines, actions };
  }
  if (offer.kind === 'external' || pending) {
    return { lines, actions };
  }
  if (offer.kind === 'installable') {
    return {
      lines: [...lines, RECOMMEND_LINE],
      actions: [OFFER_ACTIONS.installMillennium, OFFER_ACTIONS.millenniumInfo],
    };
  }
  if (offer.reason === null || offer.reason === 'no-release') {
    return { lines: [...lines, RECOMMEND_LINE], actions: [OFFER_ACTIONS.millenniumInfo] };
  }
  return {
    lines: [
      ...lines,
      {
        key: 'unsupported',
        text: `Переклад досягнень у Steam недоступний: ${millenniumUnsupportedText(offer.reason)}`,
      },
    ],
    actions,
  };
}

const BRIDGE_UPDATE_LINE: PluginHostLine = {
  key: 'bridge-update',
  text: 'Оновлення плагіна «LBK Bridge» застосується після перезапуску Steam.',
};

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
    lines: [BRIDGE_UPDATE_LINE, ...entries.lines],
    actions: bridge.canRestartSteam
      ? [OFFER_ACTIONS.restartSteam, ...entries.actions]
      : entries.actions,
  };
}
