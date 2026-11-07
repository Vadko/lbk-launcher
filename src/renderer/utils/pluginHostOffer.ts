import { match, P } from 'ts-pattern';
import { t } from '@/shared/i18n/i18n';
import type {
  AchievementsBadge,
  AchievementsDelivery,
  MillenniumUnsupportedReason,
  PluginHostState,
} from '@/shared/plugin-host-types';
import type { SteamPluginSetupVariant } from '../store/useSteamPluginSetupStore';
import { achievementsBadgeDetail } from './steamPluginHost';

export type OfferTarget =
  | SteamPluginSetupVariant
  | 'millennium-site'
  | 'decky-site'
  | 'settings'
  | 'steam-restart';

export type OfferIcon =
  | 'download'
  | 'external'
  | 'update'
  | 'repair'
  | 'remove'
  | 'settings'
  | 'restart';

export interface OfferAction {
  key: string;
  label: string;
  icon: OfferIcon;
  target: OfferTarget;
  // Opens a site: never blocked while LBK changes Millennium, and keeps the dialog it sits in open.
  external: boolean;
}

type OfferActionSpec = Pick<OfferAction, 'key' | 'icon' | 'target'>;

// Each name is also its label's key under `pluginOffer`.
const OFFER_ACTIONS = {
  installMillennium: { key: 'install', icon: 'download', target: 'millennium-install' },
  repairMillennium: { key: 'repair', icon: 'repair', target: 'millennium-install' },
  uninstallMillennium: {
    key: 'uninstall',
    icon: 'remove',
    target: 'millennium-uninstall',
  },
  millenniumInfo: { key: 'site', icon: 'external', target: 'millennium-site' },
  millenniumSite: { key: 'millennium-site', icon: 'external', target: 'millennium-site' },
  installDeckyLoader: {
    key: 'decky-loader-install',
    icon: 'download',
    target: 'decky-install',
  },
  installDeckyPlugin: { key: 'decky-install', icon: 'download', target: 'decky-install' },
  updateDeckyPlugin: { key: 'decky-update', icon: 'update', target: 'decky-install' },
  deckyInfo: { key: 'decky-site', icon: 'external', target: 'decky-site' },
  openSettings: { key: 'settings', icon: 'settings', target: 'settings' },
  restartSteam: { key: 'steam-restart', icon: 'restart', target: 'steam-restart' },
} as const satisfies Record<string, OfferActionSpec>;

function withLabel(spec: OfferActionSpec, label: string): OfferAction {
  const external = spec.target === 'millennium-site' || spec.target === 'decky-site';
  return { ...spec, label, external };
}

export function offerAction(name: keyof typeof OFFER_ACTIONS): OfferAction {
  return withLabel(OFFER_ACTIONS[name], t(`pluginOffer.${name}`));
}

export function updateMillenniumAction(version: string): OfferAction {
  return withLabel(
    { key: 'update', icon: 'update', target: 'millennium-install' },
    t('pluginOffer.updateMillennium', { version })
  );
}

export type MillenniumOffer =
  | {
      kind: 'managed';
      version: string | null;
      needsRepair: boolean;
      update: string | null;
    }
  | { kind: 'external' }
  | { kind: 'installable' }
  | { kind: 'unavailable'; reason: MillenniumUnsupportedReason | null };

// What LBK can do about Millennium here; a queued activation or removal is read separately from `pending`.
export function millenniumOffer(host: PluginHostState): MillenniumOffer {
  const { installed, update, supported, unsupportedReason } = host.millennium;
  if (installed?.managedBy === 'lbk') {
    return {
      kind: 'managed',
      version: installed.version,
      needsRepair: installed.needsRepair,
      update: update?.version ?? null,
    };
  }
  if (installed) {
    return { kind: 'external' };
  }
  if (host.host === 'millennium' && supported) {
    return { kind: 'installable' };
  }
  return { kind: 'unavailable', reason: unsupportedReason };
}

export type DeckyOffer =
  | { kind: 'no-decky'; canInstallLoader: boolean }
  | { kind: 'plugin-disabled' }
  | { kind: 'plugin-missing' }
  | { kind: 'plugin-outdated' }
  | { kind: 'plugin-ready' };

export function deckyOffer(host: PluginHostState): DeckyOffer {
  return match(host.decky)
    .returnType<DeckyOffer>()
    .with(P.union(null, { installed: false }), () => ({
      kind: 'no-decky',
      canInstallLoader: host.deckyLoader !== null,
    }))
    .with({ plugin: { installed: true, disabled: true } }, () => ({
      kind: 'plugin-disabled',
    }))
    .with({ plugin: { installed: false } }, () => ({ kind: 'plugin-missing' }))
    .with({ plugin: { outdated: true } }, () => ({ kind: 'plugin-outdated' }))
    .with({ plugin: { disabled: false, outdated: false } }, () => ({
      kind: 'plugin-ready',
    }))
    .exhaustive();
}

// Only Decky's own settings can enable it again, so this state gets no install offer.
export function deckyPluginDisabled(decky: PluginHostState['decky']): boolean {
  return decky?.plugin.installed === true && decky.plugin.disabled;
}

interface DeliveryNote {
  text: string;
  actions: OfferAction[];
}

// The install buttons ignore the "don't offer again" flags: next to a disabled checkbox they are the only way to enable it.
const DELIVERY_NOTES: Record<
  AchievementsBadge['state'],
  (badge: AchievementsBadge, pluginDisabled: boolean) => DeliveryNote | null
> = {
  millennium: () => null,
  decky: () => null,
  'after-restart': () => null,
  'needs-millennium': (badge) => ({
    text: t('achievementsNote.needsMillennium'),
    actions:
      badge.unsupportedReason === null
        ? [offerAction('installMillennium'), offerAction('millenniumInfo')]
        : [offerAction('millenniumInfo')],
  }),
  'needs-decky-plugin': (_badge, pluginDisabled) =>
    pluginDisabled
      ? { text: t('achievementsNote.deckyPluginDisabled'), actions: [] }
      : {
          text: t('achievementsNote.needsDeckyPlugin'),
          actions: [offerAction('installDeckyPlugin')],
        },
  'needs-decky': () => ({
    text: t('achievementsNote.needsDecky'),
    actions: [offerAction('installDeckyLoader'), offerAction('deckyInfo')],
  }),
  'setting-off': (badge) => ({
    text: t('achievementsNote.settingOff', {
      detail: achievementsBadgeDetail(badge) ?? '',
    }),
    actions: [offerAction('openSettings')],
  }),
  unsupported: (badge) => ({
    text: t('achievementsNote.unsupported', {
      detail: achievementsBadgeDetail(badge) ?? '',
    }),
    actions:
      badge.unsupportedReason === 'millennium-v2' ? [offerAction('millenniumSite')] : [],
  }),
};

export function deliveryNote(
  badge: AchievementsBadge,
  decky: PluginHostState['decky']
): DeliveryNote | null {
  return DELIVERY_NOTES[badge.state](badge, deckyPluginDisabled(decky));
}

interface SuccessOfferContext {
  millenniumInstallable: boolean;
  deckyPluginDisabled: boolean;
  declined: { millennium: boolean; decky: boolean };
}

// Unlike the install-options note, the success modal respects «Більше не пропонувати».
const SUCCESS_OFFERS: Record<
  AchievementsDelivery,
  (context: SuccessOfferContext) => OfferAction | null
> = {
  'plugin-live': () => null,
  'plugin-next-start': () => null,
  'needs-millennium': ({ millenniumInstallable, declined }) =>
    !declined.millennium && millenniumInstallable
      ? offerAction('installMillennium')
      : offerAction('millenniumInfo'),
  'needs-decky-plugin': ({ deckyPluginDisabled, declined }) =>
    declined.decky || deckyPluginDisabled ? null : offerAction('installDeckyPlugin'),
  'needs-decky': ({ declined }) =>
    declined.decky ? offerAction('deckyInfo') : offerAction('installDeckyLoader'),
  unavailable: () => null,
  disabled: () => offerAction('openSettings'),
};

export function successOffer(
  delivery: AchievementsDelivery,
  context: SuccessOfferContext
): OfferAction | null {
  return SUCCESS_OFFERS[delivery](context);
}
