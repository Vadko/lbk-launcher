import { G } from '@mobily/ts-belt';
import type { OpHandlers, SharedSteamOps } from './contract';
import type { LibraryApp, SteamApps, SteamGlobals } from './steam-globals';

const NON_STEAM_APPID_MIN = 2147483648;
const SHORTCUT_NAME = 'LBK Launcher';
const SEMVER = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
// Decky opens the path as root, so only our own cache zip for exactly this version is accepted.
const DECKY_ZIP_URL = new RegExp(
  '^file:///(?:var/)?home/[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}/' +
    '(?:\\.cache|\\.var/app/[A-Za-z][\\w-]*(?:\\.[\\w-]+)+/cache)' +
    '/lbk-launcher/decky/lbk-bridge-(\\d{1,4}\\.\\d{1,4}\\.\\d{1,4})\\.zip$'
);

function fail(what: string): never {
  throw new Error(`lbk-ops: invalid ${what}`);
}

const isInt = (v: unknown): v is number => G.isNumber(v) && Number.isInteger(v);
const appIdArg = (v: unknown): number =>
  isInt(v) && v > 0 && v <= 4294967295 ? v : fail('appId');
const isShortcutId = (v: unknown): v is number =>
  isInt(v) && v >= NON_STEAM_APPID_MIN && v <= 4294967295;
const shortcutIdArg = (v: unknown): number =>
  isShortcutId(v) ? v : fail('shortcut appId');
const digitsArg = (v: unknown): string =>
  G.isString(v) && /^\d{1,20}$/.test(v) ? v : fail('id');
const textArg = (v: unknown, max: number): string =>
  G.isString(v) && v.length <= max ? v : fail('text');
const boolArg = (v: unknown): boolean => (G.isBoolean(v) ? v : fail('flag'));
const intArg = (v: unknown, min: number, max: number): number =>
  isInt(v) && v >= min && v <= max ? v : fail('int');
const argsObj = (a: unknown): Record<string, unknown> =>
  G.isObject(a) ? a : fail('args');
const matchArg = (v: unknown, re: RegExp, what: string): string =>
  G.isString(v) && re.test(v) ? v : fail(what);

export function createOps(g: SteamGlobals): OpHandlers<SharedSteamOps> {
  const apps = (): SteamApps => {
    const found = g.SteamClient?.Apps;
    if (!found) {
      throw new Error('SteamClient.Apps is not available');
    }
    return found;
  };
  const libraryApps = (): LibraryApp[] | null => {
    const all = g.collectionStore?.allGamesCollection?.allApps;
    return G.isArray(all) && all.length > 0 ? all : null;
  };

  return {
    ping: async () => ({ ok: true }),

    libraryAppIds: async () => {
      const library = libraryApps();
      if (!library) {
        return 'unavailable';
      }
      return library
        .map((x) => x.appid)
        .filter((id) => Number.isInteger(id) && id > 0 && id < NON_STEAM_APPID_MIN);
    },

    setLaunchOptions: async (a: unknown) => {
      const args = argsObj(a);
      await apps().SetAppLaunchOptions(appIdArg(args.appId), textArg(args.value, 32768));
      return true;
    },

    workshopDownloaded: async (a: unknown) => {
      const args = argsObj(a);
      if (!G.isArray(args.targets) || args.targets.length > 5000) {
        fail('targets');
      }
      const targets = args.targets.map((t: unknown) => {
        const target = argsObj(t);
        return {
          id: textArg(target.id, 128),
          appId: appIdArg(target.appId),
          itemId: digitsArg(target.itemId),
        };
      });
      const steamApps = g.SteamClient?.Apps;
      if (!G.isFunction(steamApps?.GetDownloadedWorkshopItems)) {
        return 'unknown';
      }
      const byApp = new Map<number, readonly unknown[]>();
      const found: string[] = [];
      for (const t of targets) {
        let items = byApp.get(t.appId);
        if (!items) {
          let fetched: unknown;
          try {
            fetched = await steamApps.GetDownloadedWorkshopItems(t.appId);
          } catch {
            return 'unknown';
          }
          if (!G.isArray(fetched)) {
            return 'unknown';
          }
          items = fetched;
          byApp.set(t.appId, items);
        }
        if (items.some((i) => G.isObject(i) && String(i.publishedfileid) === t.itemId)) {
          found.push(t.id);
        }
      }
      return found;
    },

    workshopSubscribe: async (a: unknown) => {
      const args = argsObj(a);
      await apps().SubscribeWorkshopItem(
        appIdArg(args.appId),
        digitsArg(args.itemId),
        boolArg(args.subscribe)
      );
      return true;
    },

    syncCollection: async (a: unknown) => {
      const args = argsObj(a);
      if (!G.isArray(args.appIds) || args.appIds.length > 20000) {
        fail('appIds');
      }
      const name = textArg(args.name, 128) || fail('name');
      const targetIds = new Set(args.appIds.map(appIdArg));
      const recordedId = args.recordedId == null ? null : textArg(args.recordedId, 128);
      try {
        const library = libraryApps();
        const store = g.collectionStore;
        if (!library || !store) {
          return 'library-unavailable';
        }
        const owned = library.filter((x) => targetIds.has(x.appid));
        const wantedIds = new Set(owned.map((x) => x.appid));
        const byName = store.GetUserCollectionsByName(name) || [];
        const coll =
          (recordedId && byName.find((c) => c.id === recordedId)) || byName[0] || null;
        if (!coll) {
          if (owned.length === 0) {
            return 'no-matches';
          }
          const fresh = store.NewUnsavedCollection(name, null, owned);
          await store.SaveCollection(fresh);
          const saved = store.GetUserCollectionsByName(name) || [];
          return {
            created: true,
            collectionId: saved[0]?.id || fresh.id || null,
            total: owned.length,
            added: owned.length,
            removed: 0,
          };
        }
        const mine =
          coll.id === recordedId || coll.allApps.every((x) => targetIds.has(x.appid));
        const currentIds = new Set(coll.allApps.map((x) => x.appid));
        const toAdd = [...wantedIds].filter((id) => !currentIds.has(id));
        const toRemove = mine ? [...currentIds].filter((id) => !wantedIds.has(id)) : [];
        if (toAdd.length > 0) {
          await store.AddOrRemoveApp(toAdd, true, coll.id);
        }
        if (toRemove.length > 0) {
          await store.AddOrRemoveApp(toRemove, false, coll.id);
        }
        return {
          created: false,
          collectionId: mine ? coll.id : null,
          total: currentIds.size + toAdd.length - toRemove.length,
          added: toAdd.length,
          removed: toRemove.length,
        };
      } catch (e) {
        return { error: String((G.isObject(e) && e.message) || e) };
      }
    },

    findShortcut: async (a: unknown) => {
      const args = argsObj(a);
      const recorded = isShortcutId(args.recordedAppId) ? args.recordedAppId : null;
      const library = libraryApps();
      if (!library) {
        return 'unknown';
      }
      if (recorded !== null && library.some((x) => x.appid === recorded)) {
        return recorded;
      }
      const match = library.find(
        (x) => x.appid >= NON_STEAM_APPID_MIN && x.display_name === SHORTCUT_NAME
      );
      return match ? match.appid : null;
    },

    addShortcut: async (a: unknown) => {
      const args = argsObj(a);
      const id: unknown = await apps().AddShortcut(
        SHORTCUT_NAME,
        textArg(args.exe, 4096),
        textArg(args.startDir, 4096),
        textArg(args.launchOptions, 4096)
      );
      if (!isInt(id)) {
        throw new Error(`lbk-ops: AddShortcut returned ${String(id)}`);
      }
      return id;
    },

    updateShortcut: async (a: unknown) => {
      const args = argsObj(a);
      const id = shortcutIdArg(args.appId);
      const exe = textArg(args.exe, 4096);
      const startDir = textArg(args.startDir, 4096);
      const icon = textArg(args.icon, 4096);
      const launchOptions = textArg(args.launchOptions, 4096);
      const steamApps = apps();
      await steamApps.SetShortcutName(id, SHORTCUT_NAME);
      await steamApps.SetShortcutExe(id, exe);
      await steamApps.SetShortcutStartDir(id, startDir);
      await steamApps.SetShortcutIcon(id, icon);
      await steamApps.SetShortcutLaunchOptions(id, launchOptions);
      return true;
    },

    setArtwork: async (a: unknown) => {
      const args = argsObj(a);
      const appId = appIdArg(args.appId);
      const b64 = textArg(args.base64, 33554432);
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
        fail('base64');
      }
      const ext = matchArg(args.ext, /^(png|jpg|jpeg)$/, 'ext');
      const assetType = intArg(args.assetType, 0, 4);
      await apps().SetCustomArtworkForApp(appId, b64, ext, assetType);
      return true;
    },

    clearArtwork: async (a: unknown) => {
      const args = argsObj(a);
      await apps().ClearCustomArtworkForApp(
        appIdArg(args.appId),
        intArg(args.assetType, 0, 4)
      );
      return true;
    },

    deckyRequestInstall: async (a: unknown) => {
      const args = argsObj(a);
      const version = matchArg(args.version, SEMVER, 'version');
      const artifact = textArg(args.artifact, 512);
      const m = DECKY_ZIP_URL.exec(artifact);
      if (!m || m[1] !== version) {
        fail('artifact');
      }
      const hash = matchArg(args.hash, /^[0-9a-f]{64}$/, 'hash');
      const installType = intArg(args.installType, 0, 2);
      const backend = g.window?.DeckyBackend;
      if (!G.isFunction(backend?.call)) {
        return 'no-decky';
      }
      await backend.call(
        'utilities/install_plugin',
        artifact,
        'LBK Bridge',
        version,
        hash,
        installType
      );
      return 'prompted';
    },
  };
}
