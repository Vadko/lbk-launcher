import { match, P } from 'ts-pattern';
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
    'Встановити Millennium',
    'download',
    'millennium-install'
  ),
  repairMillennium: offerAction(
    'repair',
    'Відновити Millennium',
    'repair',
    'millennium-install'
  ),
  uninstallMillennium: offerAction(
    'uninstall',
    'Видалити Millennium',
    'remove',
    'millennium-uninstall'
  ),
  millenniumInfo: offerAction(
    'site',
    'Що таке Millennium',
    'external',
    'millennium-site'
  ),
  millenniumSite: offerAction(
    'millennium-site',
    'Відкрити сайт Millennium',
    'external',
    'millennium-site'
  ),
  installDeckyLoader: offerAction(
    'decky-loader-install',
    'Встановити Decky Loader',
    'download',
    'decky-install'
  ),
  installDeckyPlugin: offerAction(
    'decky-install',
    'Встановити плагін для Decky',
    'download',
    'decky-install'
  ),
  updateDeckyPlugin: offerAction(
    'decky-update',
    'Оновити плагін для Decky',
    'update',
    'decky-install'
  ),
  deckyInfo: offerAction('decky-site', 'Що таке Decky Loader', 'external', 'decky-site'),
  openSettings: offerAction('settings', 'Відкрити налаштування', 'settings', 'settings'),
  restartSteam: offerAction(
    'steam-restart',
    'Перезапустити Steam',
    'restart',
    'steam-restart'
  ),
};

export function updateMillenniumAction(version: string): OfferAction {
  return offerAction(
    'update',
    `Оновити Millennium до ${version}`,
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

const FILES_NOTE = 'Steam більше не показує перекладені досягнення зі звичайних файлів.';
const IN_GAME_NOTE = 'У меню самої гри назви лишаться мовою розробника.';

// The install buttons ignore the "don't offer again" flags: next to a disabled checkbox they are the only way to enable it.
const DELIVERY_NOTES: Record<
  AchievementsBadge['state'],
  (badge: AchievementsBadge) => DeliveryNote | null
> = {
  millennium: () => null,
  decky: () => null,
  'after-restart': () => null,
  'needs-millennium': (badge) => ({
    text: `${FILES_NOTE} Щоб встановити переклад досягнень і бачити його в бібліотеці, сповіщеннях та оверлеї Steam, потрібен Millennium. ${IN_GAME_NOTE}`,
    actions:
      badge.unsupportedReason === null
        ? [OFFER_ACTIONS.installMillennium, OFFER_ACTIONS.millenniumInfo]
        : [OFFER_ACTIONS.millenniumInfo],
  }),
  'needs-decky-plugin': () => ({
    text: `${FILES_NOTE} Щоб встановити переклад досягнень і бачити його в бібліотеці, сповіщеннях та оверлеї Steam, потрібен плагін «LBK Bridge» для Decky Loader. ${IN_GAME_NOTE}`,
    actions: [OFFER_ACTIONS.installDeckyPlugin],
  }),
  'needs-decky': () => ({
    text: `${FILES_NOTE} На Steam Deck переклад досягнень показує плагін «LBK Bridge» для Decky Loader, тож спершу потрібен Decky Loader. ${IN_GAME_NOTE}`,
    actions: [OFFER_ACTIONS.installDeckyLoader, OFFER_ACTIONS.deckyInfo],
  }),
  'setting-off': (badge) => ({
    text: `Переклад досягнень недоступний, поки вимкнено інтеграцію зі Steam. ${achievementsBadgeDetail(badge) ?? ''}`,
    actions: [OFFER_ACTIONS.openSettings],
  }),
  unsupported: (badge) => ({
    text: `Переклад досягнень недоступний: на цій системі Steam не може його показати. ${achievementsBadgeDetail(badge) ?? ''}`,
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
