// Shared by both plugin builds, the CDP ops bundle and LBK's main process.
export const BRIDGE_VERSION = '1.3.0';
export const BRIDGE_PLUGIN_NAME = 'lbk-bridge';
export const BRIDGE_PROTOCOL = 1;
export const BRIDGE_WS_PATH = '/lbk-bridge';
export const BRIDGE_HOSTS = ['millennium', 'decky'] as const;

export type BridgeHost = (typeof BRIDGE_HOSTS)[number];

type CollectionSyncAnswer =
  | 'library-unavailable'
  | 'no-matches'
  | { error: string }
  | {
      created: boolean;
      collectionId: string | null;
      total: number;
      added: number;
      removed: number;
    };

type NoArgs = Record<string, never>;

export interface AchievementsHookReport {
  state: 'ok' | 'not-ready' | 'failed';
  stamp: string | null;
  apps: number;
  coverage: Record<string, boolean>;
  error?: string;
}

export interface SharedSteamOps {
  ping: { args: NoArgs; result: { ok: true } };
  libraryAppIds: { args: NoArgs; result: number[] | 'unavailable' };
  setLaunchOptions: { args: { appId: number; value: string }; result: true };
  workshopDownloaded: {
    args: { targets: { id: string; appId: number; itemId: string }[] };
    result: string[] | 'unknown';
  };
  workshopSubscribe: {
    args: { appId: number; itemId: string; subscribe: boolean };
    result: true;
  };
  syncCollection: {
    args: { appIds: number[]; recordedId: string | null };
    result: CollectionSyncAnswer;
  };
  findShortcut: {
    args: { recordedAppId: number | null };
    result: number | null | 'unknown';
  };
  addShortcut: {
    args: { exe: string; startDir: string; launchOptions: string };
    result: number;
  };
  updateShortcut: {
    args: {
      appId: number;
      exe: string;
      startDir: string;
      icon: string;
      launchOptions: string;
    };
    result: true;
  };
  setArtwork: {
    args: { appId: number; base64: string; ext: string; assetType: number };
    result: true;
  };
  clearArtwork: { args: { appId: number; assetType: number }; result: true };
  deckyRequestInstall: {
    args: { artifact: string; version: string; hash: string; installType: 0 | 1 | 2 };
    result: 'no-decky' | 'prompted';
  };
}

// Only the plugin implements these; the CDP transport rejects them.
export interface PluginOnlySteamOps {
  achievementsReload: {
    args: NoArgs;
    result: { apps: number; coverage: Record<string, boolean> };
  };
  achievementsStatus: { args: NoArgs; result: AchievementsHookReport };
}

export interface SteamOps extends SharedSteamOps, PluginOnlySteamOps {}

export type SteamOpName = keyof SteamOps;

type PluginOnlyOpName = keyof PluginOnlySteamOps;

// Ops get untrusted args from the wire and check them themselves.
export type OpHandlers<T extends { [K in keyof T]: { result: unknown } }> = {
  [K in keyof T]: (args: unknown) => Promise<T[K]['result']>;
};

export const SHARED_STEAM_OPS = [
  'ping',
  'libraryAppIds',
  'setLaunchOptions',
  'workshopDownloaded',
  'workshopSubscribe',
  'syncCollection',
  'findShortcut',
  'addShortcut',
  'updateShortcut',
  'setArtwork',
  'clearArtwork',
  'deckyRequestInstall',
] as const;

export const PLUGIN_ONLY_OPS = ['achievementsReload', 'achievementsStatus'] as const;

function _assertNever<_T extends never>(): void {
  /* compiler check */
}

_assertNever<Exclude<keyof SharedSteamOps, (typeof SHARED_STEAM_OPS)[number]>>();
_assertNever<Exclude<(typeof SHARED_STEAM_OPS)[number], keyof SharedSteamOps>>();
_assertNever<Exclude<PluginOnlyOpName, (typeof PLUGIN_ONLY_OPS)[number]>>();
_assertNever<Exclude<(typeof PLUGIN_ONLY_OPS)[number], PluginOnlyOpName>>();

export function isPluginOnlyOp(op: SteamOpName): op is PluginOnlyOpName {
  return PLUGIN_ONLY_OPS.some((name) => name === op);
}
