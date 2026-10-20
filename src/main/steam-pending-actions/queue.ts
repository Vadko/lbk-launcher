import { z } from 'zod';
import type { WriteLaunchOptionsParams } from '@/main/utils/steam-launch-options';
import {
  deleteStoreValue,
  onStoreValueChanged,
  readStoreValue,
  writeStoreValue,
} from '@/main/utils/store-storage';

const launchOptionsParamsSchema = z.object({
  appId: z.int().positive(),
  windowsOptions: z.string().nullable(),
  linuxOptions: z.string().nullable(),
  macosOptions: z.string().nullable(),
  gamePath: z.string().nullish(),
}) satisfies z.ZodType<WriteLaunchOptionsParams>;

const queuedAt = z.string();
const attempts = z.int().nonnegative();

const launchOptionsItem = z.object({
  kind: z.literal('launch-options'),
  gameId: z.string(),
  gameName: z.string(),
  accountId: z.string().nullable(),
  params: launchOptionsParamsSchema,
  queuedAt,
});
const pluginToggleItem = z.object({
  kind: z.literal('millennium-plugin'),
  enable: z.boolean(),
  queuedAt,
});
const activateItem = z.strictObject({
  kind: z.literal('millennium-activate'),
  tag: z.string().regex(/^[\w.-]{1,64}$/),
  queuedAt,
  attempts,
});
const deactivateItem = z.strictObject({
  kind: z.literal('millennium-deactivate'),
  purge: z.boolean(),
  queuedAt,
  attempts,
});

// The store key is renderer-writable: Millennium items carry no paths and reject extra keys, main derives the rest.
const pendingSteamActionSchema = z.discriminatedUnion('kind', [
  launchOptionsItem.loose(),
  pluginToggleItem.loose(),
  activateItem,
  deactivateItem,
]);

// Built from the non-loose shapes so queue items written in code keep excess-property checks.
export type PendingSteamAction =
  | z.infer<typeof launchOptionsItem>
  | z.infer<typeof pluginToggleItem>
  | z.infer<typeof activateItem>
  | z.infer<typeof deactivateItem>;

export type PendingActionKind = PendingSteamAction['kind'];

export type PendingActionOf<K extends PendingActionKind> = Extract<
  PendingSteamAction,
  { kind: K }
>;

type MillenniumInstallAction = PendingActionOf<
  'millennium-activate' | 'millennium-deactivate'
>;

export type PendingTrigger =
  | 'steam-exit'
  | 'restart-gap'
  | 'startup'
  | 'bridge-ready'
  | 'manual';

const QUEUE_KEY = 'pending-steam-actions';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MILLENNIUM_MAX_ATTEMPTS = 5;

// Stored items are kept as they are, unknown keys included; the schema only decides which survive.
export function isPendingSteamAction(value: unknown): value is PendingSteamAction {
  return pendingSteamActionSchema.safeParse(value).success;
}

export function getPendingSteamActions(): PendingSteamAction[] {
  const raw = readStoreValue(QUEUE_KEY);
  return Array.isArray(raw) ? raw.filter(isPendingSteamAction) : [];
}

export function writeQueue(queue: PendingSteamAction[]): void {
  if (queue.length === 0) {
    deleteStoreValue(QUEUE_KEY);
    return;
  }
  writeStoreValue(QUEUE_KEY, queue);
}

export function onPendingSteamActionsChanged(callback: () => void): () => void {
  return onStoreValueChanged(QUEUE_KEY, callback);
}

function isMillenniumInstallAction(a: PendingSteamAction): a is MillenniumInstallAction {
  return a.kind === 'millennium-activate' || a.kind === 'millennium-deactivate';
}

const ACTION_KEYS: { [K in PendingActionKind]: (a: PendingActionOf<K>) => string } = {
  'launch-options': (a) => `launch-options:${a.gameId}:${a.queuedAt}`,
  'millennium-plugin': (a) => `millennium-plugin:${a.enable}:${a.queuedAt}`,
  'millennium-activate': (a) => `${a.kind}:${a.queuedAt}`,
  'millennium-deactivate': (a) => `${a.kind}:${a.queuedAt}`,
};

export function actionKey<K extends PendingActionKind>(a: PendingActionOf<K>): string {
  const key: (typeof ACTION_KEYS)[K] = ACTION_KEYS[a.kind];
  return key(a);
}

export function reducePendingQueue(
  q: PendingSteamAction[],
  a: PendingSteamAction
): PendingSteamAction[] {
  const rest = q.filter((item) => {
    if (a.kind === 'launch-options') {
      return !(item.kind === 'launch-options' && item.gameId === a.gameId);
    }
    // An install and an uninstall cancel each other; the plugin toggle is a separate concern.
    if (isMillenniumInstallAction(a)) {
      return !isMillenniumInstallAction(item);
    }
    return item.kind !== 'millennium-plugin';
  });
  return [...rest, a];
}

// Millennium installs first: the plugin toggle and its config edit only make sense afterwards.
export function orderPendingQueue(
  q: readonly PendingSteamAction[]
): PendingSteamAction[] {
  return [
    ...q.filter(isMillenniumInstallAction),
    ...q.filter((a) => !isMillenniumInstallAction(a)),
  ];
}

export function bumpAttempts(a: PendingSteamAction): PendingSteamAction {
  return isMillenniumInstallAction(a) ? { ...a, attempts: a.attempts + 1 } : a;
}

export function classifyPendingAction(
  a: PendingSteamAction,
  ctx: {
    now: number;
    accountId: string | null;
    installedGameIds: ReadonlySet<string>;
    settingOn: boolean;
    millennium: {
      pinTag: string | null;
      stagingReady: (tag: string) => boolean;
      recordPresent: boolean;
    };
  }
): 'apply' | 'keep' | 'drop' {
  const queuedAt = Date.parse(a.queuedAt);
  if (Number.isNaN(queuedAt) || ctx.now - queuedAt > MAX_AGE_MS) {
    return 'drop';
  }
  if (isMillenniumInstallAction(a)) {
    if (a.attempts >= MILLENNIUM_MAX_ATTEMPTS) {
      return 'drop';
    }
    if (a.kind === 'millennium-deactivate') {
      return ctx.millennium.recordPresent ? 'apply' : 'drop';
    }
    // An LBK update since queueing changed the pin, so the staged files are not the ones offered.
    return a.tag === ctx.millennium.pinTag && ctx.millennium.stagingReady(a.tag)
      ? 'apply'
      : 'drop';
  }
  if (a.kind === 'millennium-plugin') {
    // A toggle flipped back while the item waited makes it stale.
    return a.enable === ctx.settingOn ? 'apply' : 'drop';
  }
  if (!ctx.installedGameIds.has(a.gameId)) {
    return 'drop';
  }
  // localconfig.vdf is per account; another user's file must not get this game's options.
  if (a.accountId !== null && a.accountId !== ctx.accountId) {
    return 'keep';
  }
  return 'apply';
}
