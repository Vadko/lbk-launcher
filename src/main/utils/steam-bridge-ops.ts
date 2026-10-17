// Both LBK Bridge builds carry it; scripts/sync-millennium-plugin-ops.mjs writes it into their files.
export const MILLENNIUM_PLUGIN_VERSION = '1.1.0';

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

interface AchievementsHookReport {
  state: 'ok' | 'not-ready' | 'failed';
  stamp: string | null;
  apps: number;
  coverage: Record<string, boolean>;
  error?: string;
}

interface SharedSteamOps {
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

// Implemented by the plugin outside the generated ops block; the CDP transport rejects them.
interface PluginOnlySteamOps {
  achievementsReload: {
    args: NoArgs;
    result: { apps: number; coverage: Record<string, boolean> };
  };
  achievementsStatus: { args: NoArgs; result: AchievementsHookReport };
}

export interface SteamOps extends SharedSteamOps, PluginOnlySteamOps {}

export type SteamOpName = keyof SteamOps;

type SharedSteamOpName = keyof SharedSteamOps;
type PluginOnlyOpName = keyof PluginOnlySteamOps;

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

_assertNever<Exclude<SharedSteamOpName, (typeof SHARED_STEAM_OPS)[number]>>();
_assertNever<Exclude<(typeof SHARED_STEAM_OPS)[number], SharedSteamOpName>>();
_assertNever<Exclude<PluginOnlyOpName, (typeof PLUGIN_ONLY_OPS)[number]>>();
_assertNever<Exclude<(typeof PLUGIN_ONLY_OPS)[number], PluginOnlyOpName>>();

export function isPluginOnlyOp(op: SteamOpName): op is PluginOnlyOpName {
  return (PLUGIN_ONLY_OPS as readonly string[]).includes(op);
}

// Evaluated over CDP and inlined into the Millennium plugin: no backticks, no interpolation.
export const STEAM_OPS_SOURCE = String.raw`(() => {
  const NON_STEAM_APPID_MIN = 2147483648;
  const SHORTCUT_NAME = 'LBK Launcher';
  const COLLECTION_NAME = 'З українізаторами';
  const fail = (what) => {
    throw new Error('lbk-ops: invalid ' + what);
  };
  const appIdArg = (v) => (Number.isInteger(v) && v > 0 && v <= 4294967295 ? v : fail('appId'));
  const isShortcutId = (v) => Number.isInteger(v) && v >= NON_STEAM_APPID_MIN && v <= 4294967295;
  const shortcutIdArg = (v) => (isShortcutId(v) ? v : fail('shortcut appId'));
  const digitsArg = (v) => (typeof v === 'string' && /^\d{1,20}$/.test(v) ? v : fail('id'));
  const textArg = (v, max) => (typeof v === 'string' && v.length <= max ? v : fail('text'));
  const boolArg = (v) => (typeof v === 'boolean' ? v : fail('flag'));
  const intArg = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : fail('int'));
  const argsObj = (a) => (a && typeof a === 'object' ? a : fail('args'));
  const libraryApps = () => {
    if (typeof collectionStore === 'undefined' || !collectionStore) {
      return null;
    }
    const all = collectionStore.allGamesCollection;
    const apps = all && all.allApps;
    return Array.isArray(apps) && apps.length > 0 ? apps : null;
  };

  return {
    ping: async () => ({ ok: true }),

    libraryAppIds: async () => {
      const apps = libraryApps();
      if (!apps) {
        return 'unavailable';
      }
      return apps
        .map((x) => x.appid)
        .filter((id) => Number.isInteger(id) && id > 0 && id < NON_STEAM_APPID_MIN);
    },

    setLaunchOptions: async (a) => {
      argsObj(a);
      await SteamClient.Apps.SetAppLaunchOptions(appIdArg(a.appId), textArg(a.value, 32768));
      return true;
    },

    workshopDownloaded: async (a) => {
      argsObj(a);
      if (!Array.isArray(a.targets) || a.targets.length > 5000) {
        fail('targets');
      }
      const targets = a.targets.map((t) => {
        argsObj(t);
        return { id: textArg(t.id, 128), appId: appIdArg(t.appId), itemId: digitsArg(t.itemId) };
      });
      if (
        typeof SteamClient === 'undefined' ||
        !SteamClient.Apps ||
        typeof SteamClient.Apps.GetDownloadedWorkshopItems !== 'function'
      ) {
        return 'unknown';
      }
      const byApp = new Map();
      const found = [];
      for (const t of targets) {
        if (!byApp.has(t.appId)) {
          let items = null;
          try {
            items = await SteamClient.Apps.GetDownloadedWorkshopItems(t.appId);
          } catch {
            return 'unknown';
          }
          if (!Array.isArray(items)) {
            return 'unknown';
          }
          byApp.set(t.appId, items);
        }
        if (byApp.get(t.appId).some((i) => String(i.publishedfileid) === t.itemId)) {
          found.push(t.id);
        }
      }
      return found;
    },

    workshopSubscribe: async (a) => {
      argsObj(a);
      await SteamClient.Apps.SubscribeWorkshopItem(
        appIdArg(a.appId),
        digitsArg(a.itemId),
        boolArg(a.subscribe)
      );
      return true;
    },

    syncCollection: async (a) => {
      argsObj(a);
      if (!Array.isArray(a.appIds) || a.appIds.length > 20000) {
        fail('appIds');
      }
      const targetIds = new Set(a.appIds.map(appIdArg));
      const recordedId = a.recordedId == null ? null : textArg(a.recordedId, 128);
      try {
        const apps = libraryApps();
        if (!apps) {
          return 'library-unavailable';
        }
        const owned = apps.filter((x) => targetIds.has(x.appid));
        const wantedIds = new Set(owned.map((x) => x.appid));
        const byName = collectionStore.GetUserCollectionsByName(COLLECTION_NAME) || [];
        const coll = (recordedId && byName.find((c) => c.id === recordedId)) || byName[0] || null;
        if (!coll) {
          if (owned.length === 0) {
            return 'no-matches';
          }
          const fresh = collectionStore.NewUnsavedCollection(COLLECTION_NAME, null, owned);
          await collectionStore.SaveCollection(fresh);
          const saved = collectionStore.GetUserCollectionsByName(COLLECTION_NAME) || [];
          return {
            created: true,
            collectionId: (saved[0] && saved[0].id) || fresh.id || null,
            total: owned.length,
            added: owned.length,
            removed: 0,
          };
        }
        const mine = coll.id === recordedId || coll.allApps.every((x) => targetIds.has(x.appid));
        const currentIds = new Set(coll.allApps.map((x) => x.appid));
        const toAdd = [...wantedIds].filter((id) => !currentIds.has(id));
        const toRemove = mine ? [...currentIds].filter((id) => !wantedIds.has(id)) : [];
        if (toAdd.length > 0) {
          await collectionStore.AddOrRemoveApp(toAdd, true, coll.id);
        }
        if (toRemove.length > 0) {
          await collectionStore.AddOrRemoveApp(toRemove, false, coll.id);
        }
        return {
          created: false,
          collectionId: mine ? coll.id : null,
          total: currentIds.size + toAdd.length - toRemove.length,
          added: toAdd.length,
          removed: toRemove.length,
        };
      } catch (e) {
        return { error: String((e && e.message) || e) };
      }
    },

    findShortcut: async (a) => {
      argsObj(a);
      const recorded = isShortcutId(a.recordedAppId) ? a.recordedAppId : null;
      const apps = libraryApps();
      if (!apps) {
        return 'unknown';
      }
      if (recorded !== null && apps.some((x) => x.appid === recorded)) {
        return recorded;
      }
      const match = apps.find(
        (x) => x.appid >= NON_STEAM_APPID_MIN && x.display_name === SHORTCUT_NAME
      );
      return match ? match.appid : null;
    },

    addShortcut: async (a) => {
      argsObj(a);
      const id = await SteamClient.Apps.AddShortcut(
        SHORTCUT_NAME,
        textArg(a.exe, 4096),
        textArg(a.startDir, 4096),
        textArg(a.launchOptions, 4096)
      );
      if (!Number.isInteger(id)) {
        throw new Error('lbk-ops: AddShortcut returned ' + String(id));
      }
      return id;
    },

    updateShortcut: async (a) => {
      argsObj(a);
      const id = shortcutIdArg(a.appId);
      const exe = textArg(a.exe, 4096);
      const startDir = textArg(a.startDir, 4096);
      const icon = textArg(a.icon, 4096);
      const launchOptions = textArg(a.launchOptions, 4096);
      await SteamClient.Apps.SetShortcutName(id, SHORTCUT_NAME);
      await SteamClient.Apps.SetShortcutExe(id, exe);
      await SteamClient.Apps.SetShortcutStartDir(id, startDir);
      await SteamClient.Apps.SetShortcutIcon(id, icon);
      await SteamClient.Apps.SetShortcutLaunchOptions(id, launchOptions);
      return true;
    },

    setArtwork: async (a) => {
      argsObj(a);
      const appId = appIdArg(a.appId);
      const b64 = textArg(a.base64, 33554432);
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
        fail('base64');
      }
      const ext = typeof a.ext === 'string' && /^(png|jpg|jpeg)$/.test(a.ext) ? a.ext : fail('ext');
      const assetType = intArg(a.assetType, 0, 4);
      await SteamClient.Apps.SetCustomArtworkForApp(appId, b64, ext, assetType);
      return true;
    },

    clearArtwork: async (a) => {
      argsObj(a);
      await SteamClient.Apps.ClearCustomArtworkForApp(
        appIdArg(a.appId),
        intArg(a.assetType, 0, 4)
      );
      return true;
    },

    deckyRequestInstall: async (a) => {
      argsObj(a);
      const semver = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
      const version = typeof a.version === 'string' && semver.test(a.version) ? a.version : fail('version');
      // Decky opens the path as root, so only our own cache zip for exactly this version is accepted.
      const zipPath = new RegExp(
        '^file:///(?:var/)?home/[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}/' +
          '(?:\\.cache|\\.var/app/[A-Za-z][\\w-]*(?:\\.[\\w-]+)+/cache)' +
          '/lbk-launcher/decky/lbk-bridge-(\\d{1,4}\\.\\d{1,4}\\.\\d{1,4})\\.zip$'
      );
      const artifact = textArg(a.artifact, 512);
      const m = zipPath.exec(artifact);
      if (!m || m[1] !== version) {
        fail('artifact');
      }
      const hash = typeof a.hash === 'string' && /^[0-9a-f]{64}$/.test(a.hash) ? a.hash : fail('hash');
      const installType = intArg(a.installType, 0, 2);
      const b = typeof window === 'object' && window ? window.DeckyBackend : undefined;
      if (!b || typeof b.call !== 'function') {
        return 'no-decky';
      }
      await b.call('utilities/install_plugin', artifact, 'LBK Bridge', version, hash, installType);
      return 'prompted';
    },
  };
})()`;
