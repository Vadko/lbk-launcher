import type { Apps } from '@decky/ui/dist/globals/steam-client/App';

// Decky types imageType as 'jpg' | 'png'; the setArtwork op also accepts 'jpeg'.
export interface SteamApps
  extends Pick<
    Apps,
    | 'SetAppLaunchOptions'
    | 'GetDownloadedWorkshopItems'
    | 'SubscribeWorkshopItem'
    | 'AddShortcut'
    | 'SetShortcutName'
    | 'SetShortcutExe'
    | 'SetShortcutStartDir'
    | 'SetShortcutIcon'
    | 'SetShortcutLaunchOptions'
    | 'ClearCustomArtworkForApp'
  > {
  SetCustomArtworkForApp(
    appId: number,
    base64: string,
    imageType: string,
    assetType: number
  ): Promise<void>;
}

export interface LibraryApp {
  appid: number;
  display_name?: string;
}

interface SteamCollection {
  id: string;
  allApps: LibraryApp[];
}

interface CollectionStore {
  allGamesCollection?: { allApps?: unknown } | null;
  GetUserCollectionsByName(name: string): SteamCollection[] | null | undefined;
  NewUnsavedCollection(name: string, filter: null, apps: LibraryApp[]): SteamCollection;
  SaveCollection(collection: SteamCollection): Promise<void>;
  AddOrRemoveApp(appIds: number[], add: boolean, collectionId: string): Promise<void>;
}

interface AppDetailsStore {
  GetAppDetails?: (appId: number) => { achievements?: unknown } | null | undefined;
}

interface DeckyBackend {
  call?: (route: string, ...args: unknown[]) => Promise<unknown>;
}

export interface BridgeHandle {
  host?: string;
  dispose?: () => void;
}

// Steam's SharedJSContext globals; every one is optional because Steam creates them lazily.
export interface SteamGlobals {
  SteamClient?: { Apps?: SteamApps | null } | null;
  collectionStore?: CollectionStore | null;
  appDetailsStore?: AppDetailsStore | null;
  appDetailsCache?: object | null;
  NotificationStore?: object | null;
  appActivityStore?: unknown;
  webpackChunksteamui?: unknown;
  DeckyBackend?: DeckyBackend | null;
  localStorage?: Pick<Storage, 'getItem' | 'setItem'>;
  __LBK_BRIDGE__?: BridgeHandle;
  window?: SteamGlobals;
}

export function steamGlobals(): SteamGlobals {
  return globalThis;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export type AnyFn = (this: unknown, ...args: unknown[]) => unknown;

export function isFn(value: unknown): value is AnyFn {
  return typeof value === 'function';
}
