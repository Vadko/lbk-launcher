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

function offerAction(
  key: string,
  label: string,
  icon: OfferIcon,
  target: OfferTarget
): OfferAction {
  const external = target === 'millennium-site' || target === 'decky-site';
  return { key, label, icon, target, external };
}

export const OFFER_ACTIONS = {
  installMillennium: offerAction(
    'install',
    t('pluginOffer.installMillennium'),
    'download',
    'millennium-install'
  ),
  repairMillennium: offerAction(
    'repair',
    t('pluginOffer.repairMillennium'),
    'repair',
    'millennium-install'
  ),
  uninstallMillennium: offerAction(
    'uninstall',
    t('pluginOffer.uninstallMillennium'),
    'remove',
    'millennium-uninstall'
  ),
  millenniumInfo: offerAction(
    'site',
    t('pluginOffer.millenniumInfo'),
    'external',
    'millennium-site'
  ),
  millenniumSite: offerAction(
    'millennium-site',
    t('pluginOffer.millenniumSite'),
    'external',
    'millennium-site'
  ),
  installDeckyLoader: offerAction(
    'decky-loader-install',
    t('pluginOffer.installDeckyLoader'),
    'download',
    'decky-install'
  ),
  installDeckyPlugin: offerAction(
    'decky-install',
    t('pluginOffer.installDeckyPlugin'),
    'download',
    'decky-install'
  ),
  updateDeckyPlugin: offerAction(
    'decky-update',
    t('pluginOffer.updateDeckyPlugin'),
    'update',
    'decky-install'
  ),
  deckyInfo: offerAction(
    'decky-site',
    t('pluginOffer.deckyInfo'),
    'external',
    'decky-site'
  ),
  openSettings: offerAction(
    'settings',
    t('pluginOffer.openSettings'),
    'settings',
    'settings'
  ),
  restartSteam: offerAction(
    'steam-restart',
    t('pluginOffer.restartSteam'),
    'restart',
    'steam-restart'
  ),
};

export function updateMillenniumAction(version: string): OfferAction {
  return offerAction(
    'update',
    t('pluginOffer.updateMillennium', { version }),
    'update',
    'millennium-install'
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

interface DeliveryNote {
  text: string;
  actions: OfferAction[];
}

// The install buttons ignore the "don't offer again" flags: next to a disabled checkbox they are the only way to enable it.
const DELIVERY_NOTES: Record<
  AchievementsBadge['state'],
  (badge: AchievementsBadge) => DeliveryNote | null
> = {
  millennium: () => null,
  decky: () => null,
  'after-restart': () => null,
  'needs-millennium': (badge) => ({
    text: t('achievementsNote.needsMillennium'),
    actions:
      badge.unsupportedReason === null
        ? [OFFER_ACTIONS.installMillennium, OFFER_ACTIONS.millenniumInfo]
        : [OFFER_ACTIONS.millenniumInfo],
  }),
  'needs-decky-plugin': () => ({
    text: t('achievementsNote.needsDeckyPlugin'),
    actions: [OFFER_ACTIONS.installDeckyPlugin],
  }),
  'needs-decky': () => ({
    text: t('achievementsNote.needsDecky'),
    actions: [OFFER_ACTIONS.installDeckyLoader, OFFER_ACTIONS.deckyInfo],
  }),
  'setting-off': (badge) => ({
    text: t('achievementsNote.settingOff', {
      detail: achievementsBadgeDetail(badge) ?? '',
    }),
    actions: [OFFER_ACTIONS.openSettings],
  }),
  unsupported: (badge) => ({
    text: t('achievementsNote.unsupported', {
      detail: achievementsBadgeDetail(badge) ?? '',
    }),
    actions:
      badge.unsupportedReason === 'millennium-v2' ? [OFFER_ACTIONS.millenniumSite] : [],
  }),
};

export function deliveryNote(badge: AchievementsBadge): DeliveryNote | null {
  return DELIVERY_NOTES[badge.state](badge);
}

interface SuccessOfferContext {
  millenniumInstallable: boolean;
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
      ? OFFER_ACTIONS.installMillennium
      : OFFER_ACTIONS.millenniumInfo,
  'needs-decky-plugin': ({ declined }) =>
    declined.decky ? null : OFFER_ACTIONS.installDeckyPlugin,
  'needs-decky': ({ declined }) =>
    declined.decky ? OFFER_ACTIONS.deckyInfo : OFFER_ACTIONS.installDeckyLoader,
  unavailable: () => null,
  disabled: () => OFFER_ACTIONS.openSettings,
};

export function successOffer(
  delivery: AchievementsDelivery,
  context: SuccessOfferContext
): OfferAction | null {
  return SUCCESS_OFFERS[delivery](context);
}
