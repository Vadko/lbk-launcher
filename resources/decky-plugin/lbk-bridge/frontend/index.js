// LBK Bridge for Decky Loader: a frontend-only (passive) plugin running in Steam's SharedJSContext.
// LBK Launcher packs this file as lbk-bridge/dist/index.js into a zip that the user installs through Decky's own prompt.
// The @lbk-core block is copied from resources/millennium-plugin/lbk-bridge/frontend/index.js
// by scripts/sync-millennium-plugin-ops.mjs; never edit it here.
const HOST = 'decky';
// Decky serves <homebrew>/data/<plugin dir>/ at /plugins/<name>/data/, where LBK writes bridge.json and achievements.json.
const DATA_BASE = new URL('../data/', import.meta.url);

/* @lbk-core:begin */
const PLUGIN = 'lbk-bridge';
const PROTOCOL = 1;
const VERSION = '1.1.0';
const RETRY_MIN_MS = 2000;
// LBK often starts long after Steam, and until the plugin dials in every bridge op waits or fails.
const RETRY_MAX_MS = 10000;
const HANDSHAKE_TIMEOUT_MS = 5000;
const OP_TIMEOUT_MS = 30000;

let disposed = false;
let socket = null;
const timers = new Set();
const later = (fn, ms) => {
  const t = setTimeout(() => {
    timers.delete(t);
    if (!disposed) {
      fn();
    }
  }, ms);
  timers.add(t);
  return t;
};
const cancel = (t) => {
  clearTimeout(t);
  timers.delete(t);
};

/* @lbk-ops:begin */
const OPS = (() => {
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
})();
/* @lbk-ops:end */

const enc = new TextEncoder();
const toHex = (buf) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));
const randomHex = (n) => toHex(crypto.getRandomValues(new Uint8Array(n)));
const hmac = async (secretHex, msg) => {
  const key = await crypto.subtle.importKey(
    'raw', fromHex(secretHex), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
};
const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// localStorage outlives a Steam restart: after an LBK crash the stale bridge.json still holds a secret whose session ended.
const SPENT_KEY = 'lbk-bridge-spent-secrets';
const SPENT_MAX = 8;
const spentDigest = (secret) => hmac(secret, 'spent');
const readSpent = () => {
  try {
    const list = JSON.parse(window.localStorage.getItem(SPENT_KEY) || '[]');
    return Array.isArray(list) ? list.filter((d) => typeof d === 'string') : [];
  } catch {
    return [];
  }
};
const rememberSpent = async (secret) => {
  try {
    const digest = await spentDigest(secret);
    const list = readSpent().filter((d) => d !== digest);
    list.push(digest);
    window.localStorage.setItem(SPENT_KEY, JSON.stringify(list.slice(-SPENT_MAX)));
  } catch {
    // No localStorage: the in-memory guard still covers this Steam session.
  }
};
// SteamClient rejects with plain objects like {result, message}; keep them readable like the CDP transport does.
const errText = (e) => {
  if (e instanceof Error) {
    return e.message || String(e);
  }
  if (e && typeof e === 'object') {
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
};
const withTimeout = (p, ms) =>
  Promise.race([p, sleep(ms).then(() => { throw new Error('timed out after ' + ms + 'ms'); })]);

const readJson = async (name) => {
  const url = new URL(name, DATA_BASE);
  url.searchParams.set('t', String(Date.now()));
  const r = await fetch(url.href, { cache: 'no-store' });
  return r.ok ? r.json() : null;
};

// ---- Achievements: rewrites achievement strings in Steam's UI from achievements.json ----

const ACH_KEY = Symbol.for('lbk.achievementStrings');
const ACH_VERSION = 1;
const ACH_POLL_MS = 1000;
const ACH_READY_TIMEOUT_MS = 5 * 60 * 1000;
const ACH_MAX_APPS = 5000;
const ACH_ORIG = '__lbkOrig';

const sanitizeAchievements = (raw) => {
  if (!raw || raw.v !== 1 || !raw.apps || typeof raw.apps !== 'object') {
    return null;
  }
  const apps = Object.create(null);
  let count = 0;
  for (const appid of Object.keys(raw.apps)) {
    const src = raw.apps[appid];
    if (!/^\d{1,10}$/.test(appid) || !src || typeof src !== 'object' || ++count > ACH_MAX_APPS) {
      continue;
    }
    const out = Object.create(null);
    for (const api of Object.keys(src)) {
      const e = src[api];
      if (api.length > 256 || !e || typeof e !== 'object') {
        continue;
      }
      const t = Object.create(null);
      if (typeof e.name === 'string' && e.name.length > 0 && e.name.length <= 2048) {
        t.name = e.name;
      }
      if (typeof e.desc === 'string' && e.desc.length > 0 && e.desc.length <= 4096) {
        t.desc = e.desc;
      }
      if (t.name || t.desc) {
        out[api] = t;
      }
    }
    apps[appid] = out;
  }
  const stamp = typeof raw.stamp === 'string' || typeof raw.stamp === 'number' ? String(raw.stamp) : null;
  return { stamp, apps };
};

const achievementsEnvReady = (minimal) => {
  const hasApps = typeof SteamClient === 'object' && SteamClient !== null &&
    typeof SteamClient.Apps === 'object' && SteamClient.Apps !== null;
  if (minimal) {
    return hasApps;
  }
  return hasApps &&
    typeof appDetailsStore === 'object' && appDetailsStore !== null &&
    typeof appDetailsCache === 'object' && appDetailsCache !== null &&
    Array.isArray(window.webpackChunksteamui);
};

const installAchievementsHook = () => {
  const prev = window[ACH_KEY];
  if (prev && prev.version === ACH_VERSION) {
    return prev;
  }
  try {
    if (prev) {
      prev.uninstall();
    }
  } catch {
    // An older hook that cannot uninstall must not block ours.
  }

  const data = new Map();
  const undo = [];
  const coverage = {};
  let stamp = null;

  const safe = (fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('[LBK] achievements hook', e);
    }
  };
  const has = (appid) => appid !== undefined && appid !== null && data.has(String(appid));
  const lookup = (appid, id) => {
    if (id === undefined || id === null) {
      return undefined;
    }
    const m = data.get(String(appid));
    return m ? m[String(id)] : undefined;
  };

  const patchRecord = (appid, rec, keyHint, revert) => {
    const nameKey = 'strName' in rec ? 'strName' : 'name';
    const descKey = 'strDescription' in rec ? 'strDescription' : 'desc';
    if (revert) {
      if (rec[ACH_ORIG]) {
        rec[nameKey] = rec[ACH_ORIG].n;
        rec[descKey] = rec[ACH_ORIG].d;
        delete rec[ACH_ORIG];
      }
      return;
    }
    const id = rec.strID !== undefined ? rec.strID : rec.id !== undefined ? rec.id : keyHint;
    const t = lookup(appid, id);
    if (!t) {
      return;
    }
    if (!rec[ACH_ORIG]) {
      // Non-enumerable, so it never leaks into JSON Steam persists.
      Object.defineProperty(rec, ACH_ORIG, {
        value: { n: rec[nameKey], d: rec[descKey] },
        configurable: true,
      });
    }
    if (t.name) {
      rec[nameKey] = t.name;
    }
    if (t.desc) {
      rec[descKey] = t.desc;
    }
  };
  const walk = (appid, node, revert, depth, keyHint) => {
    if (!node || typeof node !== 'object' || depth > 6) {
      return;
    }
    if (Array.isArray(node)) {
      for (const x of node) {
        walk(appid, x, revert, depth + 1);
      }
      return;
    }
    if (typeof node.strName === 'string' || typeof node.strDescription === 'string') {
      try {
        patchRecord(appid, node, keyHint, revert);
      } catch {
        // A frozen record stays untranslated; its siblings still get patched.
      }
      return;
    }
    for (const k of Object.keys(node)) {
      walk(appid, node[k], revert, depth + 1, k);
    }
  };

  const wrap = (obj, key, make, label) => {
    try {
      const orig = obj ? obj[key] : undefined;
      if (typeof orig !== 'function') {
        coverage[label] = false;
        return;
      }
      const hadOwn = Object.prototype.hasOwnProperty.call(obj, key);
      const w = make(orig);
      obj[key] = w;
      if (obj[key] !== w) {
        coverage[label] = false;
        return;
      }
      undo.push(() => {
        if (obj[key] === w) {
          if (hadOwn) {
            obj[key] = orig;
          } else {
            delete obj[key];
          }
        }
      });
      coverage[label] = true;
    } catch {
      coverage[label] = false;
    }
  };

  let req = null;
  safe(() => window.webpackChunksteamui.push([[Symbol('lbk')], {}, (r) => { req = r; }]));
  const findExport = (marker, pred) => {
    if (!req || !req.m) {
      return undefined;
    }
    for (const id of Object.keys(req.m)) {
      let mod;
      try {
        if (!String(req.m[id]).includes(marker)) {
          continue;
        }
        mod = req(id);
      } catch {
        continue;
      }
      for (const k of Object.keys(mod || {})) {
        try {
          if (pred(mod[k])) {
            return mod[k];
          }
        } catch {
          // Lazy getters can throw before their module finishes initialising.
        }
      }
    }
    return undefined;
  };
  // A MobX ObservableMap, not a Map instance.
  const achStore = findExport('LoadMyAchievements', (v) =>
    v && v.m_mapMyAchievements && typeof v.m_mapMyAchievements.delete === 'function'
  );
  coverage.achStore = Boolean(achStore);
  const ToastData = findExport('CClientNotificationAchievement', (v) =>
    typeof v === 'function' && v.prototype && typeof v.prototype.getClassName === 'function' &&
    v.prototype.getClassName() === 'CClientNotificationAchievement'
  );

  const afterResult = (o) => function (appid, ...rest) {
    const r = o.call(this, appid, ...rest);
    if (!has(appid)) {
      return r;
    }
    const patch = (v) => {
      safe(() => walk(appid, v && v.data !== undefined ? v.data : v, false, 0));
      return v;
    };
    return r && typeof r.then === 'function' ? r.then(patch) : patch(r);
  };
  const patchJson = (appid, r) => {
    if (typeof r !== 'string' || !has(appid)) {
      return r;
    }
    try {
      const j = JSON.parse(r);
      walk(appid, j, false, 0);
      return JSON.stringify(j);
    } catch {
      return r;
    }
  };

  const A = SteamClient.Apps;
  wrap(A, 'GetMyAchievementsForApp', afterResult, 'library');
  wrap(A, 'GetFriendAchievementsForApp', afterResult, 'friends');
  wrap(A, 'GetAchievementsInTimeRange', afterResult, 'timeline');
  wrap(A, 'GetCachedAppDetails', (o) => function (appid, ...rest) {
    const r = o.call(this, appid, ...rest);
    return r && typeof r.then === 'function' ? r.then((v) => patchJson(appid, v)) : patchJson(appid, r);
  }, 'cachedDetails');
  wrap(typeof appDetailsCache === 'object' ? appDetailsCache : null, 'SetCachedDataForApp',
    (o) => function (appid, key, ver, value, ...rest) {
      if (has(appid)) {
        safe(() => walk(appid, value, false, 0));
      }
      const r = o.call(this, appid, key, ver, value, ...rest);
      if (key === 'achievements' && has(appid)) {
        // AppDetailsChanged stores a MobX copy of the details just before this call; the UI renders that copy.
        safe(() => patchLoaded([appid], false));
      }
      return r;
    }, 'appDetails');

  if (ToastData && typeof ToastData.prototype.name !== 'function') {
    // Protobuf message classes define their accessors on the prototype on first construction.
    safe(() => new ToastData());
  }
  for (const [method, field] of [['name', 'name'], ['description', 'desc']]) {
    wrap(ToastData ? ToastData.prototype : null, method, (o) => function (...args) {
      const v = o.apply(this, args);
      if (args.length > 0) {
        return v;
      }
      let t;
      safe(() => {
        t = lookup(this.appid && this.appid(), this.achievement_id && this.achievement_id());
      });
      return (t && t[field]) || v;
    }, 'toast.' + method);
  }
  if (!coverage['toast.name'] && typeof NotificationStore === 'object' && NotificationStore) {
    // Achievement toast payloads are protobuf messages; patch them on the way in instead.
    wrap(NotificationStore, 'ProcessNotification', (o) => function (notif, ...rest) {
      safe(() => {
        const d = notif && notif.eType === 5 ? notif.data : null;
        if (d && typeof d.appid === 'function' && typeof d.achievement_id === 'function') {
          const t = lookup(d.appid(), d.achievement_id());
          if (t && t.name && typeof d.set_name === 'function') {
            d.set_name(t.name);
          }
          if (t && t.desc && typeof d.set_description === 'function') {
            d.set_description(t.desc);
          }
        }
      });
      return o.call(this, notif, ...rest);
    }, 'toastFallback');
  }

  const invalidate = (appids) => {
    for (const id of appids) {
      for (const k of [Number(id), String(id)]) {
        safe(() => {
          if (achStore && achStore.m_mapMyAchievements) {
            achStore.m_mapMyAchievements.delete(k);
          }
          if (achStore && achStore.m_mapGlobalAchievements) {
            achStore.m_mapGlobalAchievements.delete(k);
          }
        });
      }
    }
  };
  const patchLoaded = (appids, revert) => {
    if (typeof appDetailsStore !== 'object' || !appDetailsStore ||
      typeof appDetailsStore.GetAppDetails !== 'function') {
      return;
    }
    for (const id of appids) {
      safe(() => {
        const details = appDetailsStore.GetAppDetails(Number(id));
        walk(id, details && details.achievements, revert, 0);
      });
    }
  };

  const api = {
    version: ACH_VERSION,
    get stamp() {
      return stamp;
    },
    replaceData(p) {
      const next = new Map(Object.entries((p && p.apps) || {}));
      const touched = new Set([...data.keys(), ...next.keys()]);
      patchLoaded(touched, true);
      data.clear();
      for (const [k, v] of next) {
        data.set(k, v);
      }
      patchLoaded(touched, false);
      invalidate(touched);
      stamp = p ? p.stamp : null;
    },
    report() {
      return { state: 'ok', version: ACH_VERSION, stamp, apps: data.size, coverage: Object.assign({}, coverage) };
    },
    uninstall() {
      const all = [...data.keys()];
      patchLoaded(all, true);
      while (undo.length) {
        safe(undo.pop());
      }
      data.clear();
      invalidate(all);
      delete window[ACH_KEY];
    },
  };
  Object.defineProperty(window, ACH_KEY, { value: api, configurable: true });
  return api;
};

const ach = {
  state: 'not-ready',
  error: null,
  hook: null,
  startedAt: Date.now(),
  loop: null,
  reloadRequested: false,
};

const loadAchievementsFile = async () => {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return { payload: sanitizeAchievements(await readJson('achievements.json')) };
    } catch (e) {
      lastError = e;
      await sleep(2000);
    }
  }
  throw lastError;
};

const applyAchievements = (payload) => {
  if (disposed) {
    return;
  }
  const apps = payload ? payload.apps : {};
  // No translations, no hooks: leave Steam untouched until there is something to show.
  if (!ach.hook && Object.keys(apps).length === 0) {
    return;
  }
  if (!ach.hook) {
    ach.hook = installAchievementsHook();
  }
  ach.hook.replaceData({ stamp: payload ? payload.stamp : null, apps });
};

const reloadAchievements = async () => {
  const { payload } = await loadAchievementsFile();
  applyAchievements(payload);
  ach.state = 'ok';
  ach.error = null;
};

// Millennium injects plugins right after App.BFinishedInitBeforeLogin, before the stores exist.
const startAchievements = () => {
  if (ach.loop) {
    return ach.loop;
  }
  ach.loop = (async () => {
    while (!achievementsEnvReady(false)) {
      if (disposed) {
        return;
      }
      if (Date.now() - ach.startedAt >= ACH_READY_TIMEOUT_MS) {
        if (achievementsEnvReady(true)) {
          break;
        }
        ach.state = 'failed';
        ach.error = 'steam ui not ready';
        return;
      }
      await sleep(ACH_POLL_MS);
    }
    try {
      do {
        ach.reloadRequested = false;
        await reloadAchievements();
      } while (ach.reloadRequested && !disposed);
    } catch (e) {
      ach.state = 'failed';
      ach.error = errText(e);
    }
  })().finally(() => {
    ach.loop = null;
  });
  return ach.loop;
};

const achievementsReport = () => {
  const r = ach.hook ? ach.hook.report() : { stamp: null, apps: 0, coverage: {} };
  const out = { state: ach.state, stamp: r.stamp, apps: r.apps, coverage: r.coverage };
  if (ach.error) {
    out.error = ach.error;
  }
  return out;
};

const PLUGIN_OPS = {
  achievementsReload: async () => {
    if (ach.loop) {
      // The startup loop reads achievements.json once Steam's stores exist, and again if asked meanwhile.
      ach.reloadRequested = true;
      return { apps: 0, coverage: {} };
    }
    if (!achievementsEnvReady(ach.state === 'failed')) {
      startAchievements();
      return { apps: 0, coverage: {} };
    }
    await reloadAchievements();
    const r = achievementsReport();
    return { apps: r.apps, coverage: r.coverage };
  },
  achievementsStatus: async () => achievementsReport(),
};

const HANDLERS = Object.assign(Object.create(null), OPS, PLUGIN_OPS);

// ---- Transport: authenticated WebSocket client to LBK's loopback server ----

const state = {
  host: HOST,
  version: VERSION,
  status: 'idle',
  idle: false,
  connectedAt: null,
  lastError: null,
  achievements: () => achievementsReport(),
  dispose: () => dispose(),
};

const startBridge = () => {
  let retryMs = RETRY_MIN_MS;
  let chain = Promise.resolve();
  // LBK writes a new secret whenever a session ends; a stale one means LBK is gone and its port may belong to someone else.
  let spentSecret = null;
  const schedule = () => {
    if (disposed) {
      return;
    }
    state.status = 'waiting';
    later(connect, retryMs);
    retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
  };

  async function connect() {
    let cfg = null;
    try {
      cfg = await readJson('bridge.json');
    } catch (e) {
      state.lastError = errText(e);
    }
    if (disposed) {
      return;
    }
    if (
      !cfg || cfg.v !== PROTOCOL || !Number.isInteger(cfg.port) ||
      cfg.port < 1024 || cfg.port > 65535 ||
      typeof cfg.secret !== 'string' || !/^[0-9a-f]{64}$/.test(cfg.secret) ||
      cfg.secret === spentSecret
    ) {
      schedule();
      return;
    }
    if (readSpent().includes(await spentDigest(cfg.secret))) {
      if (!disposed) {
        schedule();
      }
      return;
    }

    state.status = 'connecting';
    let ws;
    try {
      ws = new WebSocket('ws://127.0.0.1:' + cfg.port + '/lbk-bridge');
    } catch (e) {
      state.lastError = errText(e);
      schedule();
      return;
    }
    socket = ws;
    const cn = randomHex(16);
    let sn = null;
    let authed = false;
    const timer = later(() => ws.close(4000, 'handshake timeout'), HANDSHAKE_TIMEOUT_MS);
    const send = (o) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(o));
      }
    };

    ws.onopen = () =>
      send({ t: 'hello', v: PROTOCOL, plugin: PLUGIN, pv: VERSION, host: HOST, ops: Object.keys(HANDLERS), cn });

    ws.onmessage = async (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        ws.close(4001, 'bad json');
        return;
      }
      if (!msg || typeof msg !== 'object') {
        ws.close(4001, 'bad message');
        return;
      }
      if (!authed) {
        if (msg.t === 'challenge' && sn === null && typeof msg.sn === 'string' && /^[0-9a-f]{32}$/.test(msg.sn)) {
          const expected = await hmac(cfg.secret, 'server|' + cn + '|' + msg.sn);
          if (!safeEqual(expected, msg.sp)) {
            ws.close(4003, 'server auth failed');
            return;
          }
          sn = msg.sn;
          send({ t: 'auth', cp: await hmac(cfg.secret, 'client|' + sn + '|' + cn) });
          return;
        }
        if (msg.t === 'ready' && sn !== null) {
          authed = true;
          cancel(timer);
          retryMs = RETRY_MIN_MS;
          state.status = 'connected';
          state.connectedAt = Date.now();
          return;
        }
        ws.close(4002, 'unexpected message before auth');
        return;
      }
      if (msg.t === 'ping') {
        send({ t: 'pong', id: msg.id });
        return;
      }
      if (msg.t !== 'req' || !Number.isInteger(msg.id) || typeof msg.op !== 'string') {
        return;
      }
      chain = chain.then(async () => {
        if (!Object.prototype.hasOwnProperty.call(HANDLERS, msg.op)) {
          send({ t: 'res', id: msg.id, ok: false, error: 'unknown op' });
          return;
        }
        try {
          const value = await withTimeout(HANDLERS[msg.op](msg.args || {}), OP_TIMEOUT_MS);
          send({ t: 'res', id: msg.id, ok: true, value: value === undefined ? null : value });
        } catch (e) {
          send({ t: 'res', id: msg.id, ok: false, error: errText(e) });
        }
      });
    };

    ws.onerror = () => {
      state.lastError = 'socket error';
    };
    ws.onclose = () => {
      cancel(timer);
      if (authed) {
        spentSecret = cfg.secret;
        void rememberSpent(cfg.secret);
      }
      if (socket === ws) {
        socket = null;
      }
      schedule();
    };
  }

  connect();
};

const dispose = () => {
  if (disposed) {
    return;
  }
  disposed = true;
  state.status = 'disposed';
  for (const t of timers) {
    clearTimeout(t);
  }
  timers.clear();
  const ws = socket;
  socket = null;
  if (ws) {
    try {
      ws.close(1000, 'disposed');
    } catch {
      // Already closing.
    }
  }
  const hook = ach.hook;
  ach.hook = null;
  if (hook) {
    try {
      hook.uninstall();
    } catch (e) {
      console.warn('[LBK] achievements hook uninstall', e);
    }
  }
  if (window.__LBK_BRIDGE__ === state) {
    delete window.__LBK_BRIDGE__;
  }
};

// One copy per SharedJSContext: a reload replaces its own host's copy, and Millennium's copy wins over Decky's.
const start = () => {
  if (disposed || window.__LBK_BRIDGE__ === state) {
    return;
  }
  const prev = window.__LBK_BRIDGE__;
  if (prev) {
    const prevHost = prev.host || 'millennium';
    // A 1.0.0 copy has no dispose, so it cannot be stopped and keeps the bridge.
    if (typeof prev.dispose !== 'function' || (prevHost !== HOST && HOST !== 'millennium')) {
      state.idle = true;
      return;
    }
    try {
      prev.dispose();
    } catch (e) {
      console.warn('[LBK] previous bridge dispose', e);
    }
  }
  window.__LBK_BRIDGE__ = state;
  startAchievements();
  startBridge();
};
/* @lbk-core:end */

const statusText = () => {
  if (state.idle) {
    return 'Працює через Millennium';
  }
  return state.status === 'connected' ? 'Підключено до LBK Launcher' : 'Очікування LBK Launcher';
};

const deckyView = () => {
  const R = window.SP_REACT;
  if (!R || typeof R.createElement !== 'function') {
    return { icon: null, content: null };
  }
  const h = R.createElement;
  const Status = () => {
    const [text, setText] = R.useState(statusText);
    R.useEffect(() => {
      const t = setInterval(() => setText(statusText()), 1000);
      return () => clearInterval(t);
    }, []);
    return h('div', { style: { padding: '8px 16px', fontSize: '14px', lineHeight: '20px' } }, text);
  };
  const icon = h(
    'svg',
    {
      width: '1em',
      height: '1em',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    h('path', { d: 'M2 18h20M5 18v-7M19 18v-7M12 18v-5M3 11c5-6 13-6 18 0' })
  );
  return { icon, content: h(Status) };
};

// Decky calls onDismount before it uninstalls, updates or reloads the plugin.
export default () => {
  start();
  return { name: 'LBK Bridge', ...deckyView(), onDismount: dispose };
};
