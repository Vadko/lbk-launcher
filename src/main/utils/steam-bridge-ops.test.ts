import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import {
  isPluginOnlyOp,
  PLUGIN_ONLY_OPS,
  SHARED_STEAM_OPS,
  STEAM_OPS_SOURCE,
} from '@/main/utils/steam-bridge-ops';

type OpFn = (args: unknown) => Promise<unknown>;

interface FakeApp {
  appid: number;
  display_name?: string;
}

interface FakeCollection {
  id: string;
  allApps: FakeApp[];
}

const COLLECTION_NAME = 'З українізаторами';
const SHORTCUT_ID = 3000000001;

function steamCall() {
  return vi.fn((..._args: unknown[]) => Promise.resolve(undefined));
}

function makeSteamClient() {
  return {
    Apps: {
      SetAppLaunchOptions: steamCall(),
      GetDownloadedWorkshopItems: vi.fn((appId: number) =>
        Promise.resolve(
          appId === 10 ? [{ publishedfileid: 111 }, { publishedfileid: '222' }] : []
        )
      ),
      SubscribeWorkshopItem: steamCall(),
      AddShortcut: vi.fn((..._args: unknown[]) => Promise.resolve(SHORTCUT_ID)),
      SetShortcutName: steamCall(),
      SetShortcutExe: steamCall(),
      SetShortcutStartDir: steamCall(),
      SetShortcutIcon: steamCall(),
      SetShortcutLaunchOptions: steamCall(),
      SetCustomArtworkForApp: steamCall(),
      ClearCustomArtworkForApp: steamCall(),
    },
  };
}

function makeCollectionStore(library: FakeApp[], collections: FakeCollection[]) {
  const store = {
    allGamesCollection: { allApps: library },
    GetUserCollectionsByName: vi.fn((name: string) =>
      name === COLLECTION_NAME ? collections : []
    ),
    NewUnsavedCollection: vi.fn((name: string, _filter: unknown, apps: FakeApp[]) => ({
      id: '',
      name,
      allApps: apps,
    })),
    SaveCollection: vi.fn((coll: FakeCollection) => {
      collections.push({ ...coll, id: 'uc-new' });
      return Promise.resolve();
    }),
    AddOrRemoveApp: steamCall(),
  };
  return store;
}

function loadOps(globals: Record<string, unknown> = {}) {
  const ctx = vm.createContext({ ...globals });
  const ops = vm.runInContext(STEAM_OPS_SOURCE, ctx) as Record<string, OpFn>;
  return ops;
}

const library: FakeApp[] = [
  { appid: 10 },
  { appid: 20 },
  { appid: 30 },
  { appid: SHORTCUT_ID, display_name: 'LBK Launcher' },
  { appid: 3000000002, display_name: 'Other shortcut' },
];

describe('STEAM_OPS_SOURCE', () => {
  it('has no backticks and no template interpolation', () => {
    expect(STEAM_OPS_SOURCE).not.toContain('`');
    expect(STEAM_OPS_SOURCE).not.toContain('${');
  });

  it('exposes exactly the shared ops', () => {
    const ops = loadOps();
    expect(Object.keys(ops).sort()).toEqual([...SHARED_STEAM_OPS].sort());
    for (const op of PLUGIN_ONLY_OPS) {
      expect(ops).not.toHaveProperty(op);
      expect(isPluginOnlyOp(op)).toBe(true);
    }
    for (const op of SHARED_STEAM_OPS) {
      expect(isPluginOnlyOp(op)).toBe(false);
    }
  });

  it('runs without any Steam globals for ping', async () => {
    const ops = loadOps();
    await expect(ops.ping({})).resolves.toEqual({ ok: true });
  });
});

describe('validators', () => {
  const steam = makeSteamClient();
  const ops = loadOps({ SteamClient: steam });

  it('rejects a float appId', async () => {
    await expect(ops.setLaunchOptions({ appId: 10.5, value: '' })).rejects.toThrow(
      'lbk-ops: invalid appId'
    );
    await expect(ops.clearArtwork({ appId: 0, assetType: 1 })).rejects.toThrow('appId');
    await expect(ops.clearArtwork({ appId: 2 ** 32, assetType: 1 })).rejects.toThrow(
      'appId'
    );
  });

  it('rejects a non-digit itemId', async () => {
    await expect(
      ops.workshopSubscribe({ appId: 10, itemId: '12a', subscribe: true })
    ).rejects.toThrow('lbk-ops: invalid id');
    await expect(
      ops.workshopSubscribe({ appId: 10, itemId: 12, subscribe: true })
    ).rejects.toThrow('lbk-ops: invalid id');
    await expect(
      ops.workshopDownloaded({ targets: [{ id: 'g', appId: 10, itemId: '1);' }] })
    ).rejects.toThrow('lbk-ops: invalid id');
  });

  it('rejects a non-boolean subscribe flag', async () => {
    await expect(
      ops.workshopSubscribe({ appId: 10, itemId: '1', subscribe: 'true' })
    ).rejects.toThrow('lbk-ops: invalid flag');
  });

  it('rejects overlong text', async () => {
    await expect(
      ops.addShortcut({ exe: 'x'.repeat(4097), startDir: '', launchOptions: '' })
    ).rejects.toThrow('lbk-ops: invalid text');
    await expect(
      ops.setLaunchOptions({ appId: 10, value: 'x'.repeat(32769) })
    ).rejects.toThrow('lbk-ops: invalid text');
    expect(steam.Apps.AddShortcut).not.toHaveBeenCalled();
    expect(steam.Apps.SetAppLaunchOptions).not.toHaveBeenCalled();
  });

  it('rejects bad base64 and unknown extensions', async () => {
    const base = { appId: 10, base64: 'iVBORw0KGgo=', ext: 'png', assetType: 1 };
    await expect(ops.setArtwork({ ...base, base64: 'abc"def' })).rejects.toThrow(
      'lbk-ops: invalid base64'
    );
    await expect(ops.setArtwork({ ...base, base64: '' })).rejects.toThrow('base64');
    await expect(ops.setArtwork({ ...base, ext: 'gif' })).rejects.toThrow(
      'lbk-ops: invalid ext'
    );
    expect(steam.Apps.SetCustomArtworkForApp).not.toHaveBeenCalled();
  });

  it('rejects assetType 5', async () => {
    const base = { appId: 10, base64: 'iVBORw0KGgo=', ext: 'png', assetType: 5 };
    await expect(ops.setArtwork(base)).rejects.toThrow('lbk-ops: invalid int');
    await expect(ops.clearArtwork({ appId: 10, assetType: 5 })).rejects.toThrow(
      'lbk-ops: invalid int'
    );
  });

  it('rejects a shortcut appId below 2^31 without touching Steam', async () => {
    await expect(
      ops.updateShortcut({
        appId: 10,
        exe: '"a"',
        startDir: '"b"',
        icon: 'c',
        launchOptions: '',
      })
    ).rejects.toThrow('lbk-ops: invalid shortcut appId');
    expect(steam.Apps.SetShortcutName).not.toHaveBeenCalled();
  });

  it('rejects a missing args object', async () => {
    await expect(ops.setLaunchOptions(null)).rejects.toThrow('lbk-ops: invalid args');
  });
});

describe('ops against stubbed Steam', () => {
  it('passes launch options, Workshop and artwork calls through unchanged', async () => {
    const steam = makeSteamClient();
    const ops = loadOps({ SteamClient: steam });

    await expect(
      ops.setLaunchOptions({ appId: 10, value: '-lang uk %command%' })
    ).resolves.toBe(true);
    expect(steam.Apps.SetAppLaunchOptions).toHaveBeenCalledWith(10, '-lang uk %command%');

    await ops.workshopSubscribe({ appId: 10, itemId: '123', subscribe: false });
    expect(steam.Apps.SubscribeWorkshopItem).toHaveBeenCalledWith(10, '123', false);

    await ops.setArtwork({ appId: 10, base64: 'iVBORw0KGgo=', ext: 'jpg', assetType: 3 });
    expect(steam.Apps.SetCustomArtworkForApp).toHaveBeenCalledWith(
      10,
      'iVBORw0KGgo=',
      'jpg',
      3
    );

    await ops.clearArtwork({ appId: 10, assetType: 0 });
    expect(steam.Apps.ClearCustomArtworkForApp).toHaveBeenCalledWith(10, 0);
  });

  it('lists downloaded Workshop items with one call per app', async () => {
    const steam = makeSteamClient();
    const ops = loadOps({ SteamClient: steam });
    const found = await ops.workshopDownloaded({
      targets: [
        { id: 'a', appId: 10, itemId: '111' },
        { id: 'b', appId: 10, itemId: '222' },
        { id: 'c', appId: 10, itemId: '333' },
        { id: 'd', appId: 20, itemId: '111' },
      ],
    });
    expect(found).toEqual(['a', 'b']);
    expect(steam.Apps.GetDownloadedWorkshopItems).toHaveBeenCalledTimes(2);
  });

  it('answers unknown when the Workshop API is missing or throws', async () => {
    const targets = [{ id: 'a', appId: 10, itemId: '111' }];
    await expect(loadOps().workshopDownloaded({ targets })).resolves.toBe('unknown');

    const steam = makeSteamClient();
    steam.Apps.GetDownloadedWorkshopItems.mockRejectedValueOnce(new Error('boom'));
    await expect(
      loadOps({ SteamClient: steam }).workshopDownloaded({ targets })
    ).resolves.toBe('unknown');
  });

  it('reads library app ids without shortcuts', async () => {
    const ops = loadOps({ collectionStore: makeCollectionStore(library, []) });
    await expect(ops.libraryAppIds({})).resolves.toEqual([10, 20, 30]);
    await expect(loadOps().libraryAppIds({})).resolves.toBe('unavailable');
    const empty = loadOps({ collectionStore: makeCollectionStore([], []) });
    await expect(empty.libraryAppIds({})).resolves.toBe('unavailable');
  });

  it('finds our shortcut by recorded id, then by pinned name', async () => {
    const ops = loadOps({ collectionStore: makeCollectionStore(library, []) });
    await expect(ops.findShortcut({ recordedAppId: 3000000002 })).resolves.toBe(
      3000000002
    );
    await expect(ops.findShortcut({ recordedAppId: 3999999999 })).resolves.toBe(
      SHORTCUT_ID
    );
    await expect(ops.findShortcut({ recordedAppId: null })).resolves.toBe(SHORTCUT_ID);
    await expect(ops.findShortcut({ recordedAppId: 10 })).resolves.toBe(SHORTCUT_ID);

    const none = loadOps({ collectionStore: makeCollectionStore([{ appid: 10 }], []) });
    await expect(none.findShortcut({ recordedAppId: null })).resolves.toBeNull();
    await expect(loadOps().findShortcut({ recordedAppId: null })).resolves.toBe(
      'unknown'
    );
  });

  it('adds and updates the shortcut under the pinned name only', async () => {
    const steam = makeSteamClient();
    const ops = loadOps({ SteamClient: steam });

    await expect(
      ops.addShortcut({
        exe: '"/a/lbk"',
        startDir: '"/a"',
        launchOptions: '--no-sandbox',
      })
    ).resolves.toBe(SHORTCUT_ID);
    expect(steam.Apps.AddShortcut).toHaveBeenCalledWith(
      'LBK Launcher',
      '"/a/lbk"',
      '"/a"',
      '--no-sandbox'
    );

    await ops.updateShortcut({
      appId: SHORTCUT_ID,
      exe: '"/a/lbk"',
      startDir: '"/a"',
      icon: '/a/icon.png',
      launchOptions: '',
    });
    expect(steam.Apps.SetShortcutName).toHaveBeenCalledWith(SHORTCUT_ID, 'LBK Launcher');
    expect(steam.Apps.SetShortcutExe).toHaveBeenCalledWith(SHORTCUT_ID, '"/a/lbk"');
    expect(steam.Apps.SetShortcutStartDir).toHaveBeenCalledWith(SHORTCUT_ID, '"/a"');
    expect(steam.Apps.SetShortcutIcon).toHaveBeenCalledWith(SHORTCUT_ID, '/a/icon.png');
    expect(steam.Apps.SetShortcutLaunchOptions).toHaveBeenCalledWith(SHORTCUT_ID, '');

    steam.Apps.AddShortcut.mockResolvedValueOnce(undefined as unknown as number);
    await expect(
      ops.addShortcut({ exe: '"/a/lbk"', startDir: '"/a"', launchOptions: '' })
    ).rejects.toThrow('AddShortcut returned undefined');
  });
});

describe('syncCollection', () => {
  it('reports an unavailable library', async () => {
    const ops = loadOps();
    await expect(ops.syncCollection({ appIds: [10], recordedId: null })).resolves.toBe(
      'library-unavailable'
    );
  });

  it('returns no-matches when nothing is owned and no collection exists', async () => {
    const store = makeCollectionStore(library, []);
    const ops = loadOps({ collectionStore: store });
    await expect(ops.syncCollection({ appIds: [99], recordedId: null })).resolves.toBe(
      'no-matches'
    );
    expect(store.SaveCollection).not.toHaveBeenCalled();
  });

  it('creates a manual collection with the owned games', async () => {
    const store = makeCollectionStore(library, []);
    const ops = loadOps({ collectionStore: store });
    const result = await ops.syncCollection({ appIds: [10, 20, 99], recordedId: null });
    expect(result).toEqual({
      created: true,
      collectionId: 'uc-new',
      total: 2,
      added: 2,
      removed: 0,
    });
    expect(store.NewUnsavedCollection).toHaveBeenCalledWith(COLLECTION_NAME, null, [
      library[0],
      library[1],
    ]);
  });

  it('updates our recorded collection, adding and removing', async () => {
    const coll = { id: 'uc-1', allApps: [{ appid: 10 }, { appid: 30 }] };
    const store = makeCollectionStore(library, [{ id: 'uc-other', allApps: [] }, coll]);
    const ops = loadOps({ collectionStore: store });
    const result = await ops.syncCollection({ appIds: [10, 20], recordedId: 'uc-1' });
    expect(result).toEqual({
      created: false,
      collectionId: 'uc-1',
      total: 2,
      added: 1,
      removed: 1,
    });
    expect(store.AddOrRemoveApp).toHaveBeenCalledWith([20], true, 'uc-1');
    expect(store.AddOrRemoveApp).toHaveBeenCalledWith([30], false, 'uc-1');
  });

  it('treats an unrecorded collection holding only catalog games as ours', async () => {
    const store = makeCollectionStore(library, [
      { id: 'uc-2', allApps: [{ appid: 30 }] },
    ]);
    const ops = loadOps({ collectionStore: store });
    const result = await ops.syncCollection({ appIds: [10, 30], recordedId: null });
    expect(result).toEqual({
      created: false,
      collectionId: 'uc-2',
      total: 2,
      added: 1,
      removed: 0,
    });
  });

  it('only adds to a foreign same-named collection', async () => {
    const store = makeCollectionStore(library, [
      { id: 'uc-3', allApps: [{ appid: 30 }, { appid: 555 }] },
    ]);
    const ops = loadOps({ collectionStore: store });
    const result = await ops.syncCollection({ appIds: [10], recordedId: null });
    expect(result).toEqual({
      created: false,
      collectionId: null,
      total: 3,
      added: 1,
      removed: 0,
    });
    expect(store.AddOrRemoveApp).toHaveBeenCalledTimes(1);
    expect(store.AddOrRemoveApp).toHaveBeenCalledWith([10], true, 'uc-3');
  });

  it('turns an in-page Steam failure into an error answer', async () => {
    const store = makeCollectionStore(library, [{ id: 'uc-4', allApps: [] }]);
    store.AddOrRemoveApp.mockRejectedValueOnce(new Error('steam said no'));
    const ops = loadOps({ collectionStore: store });
    await expect(
      ops.syncCollection({ appIds: [10], recordedId: 'uc-4' })
    ).resolves.toEqual({
      error: 'steam said no',
    });
  });

  it('throws on invalid arguments', async () => {
    const ops = loadOps({ collectionStore: makeCollectionStore(library, []) });
    await expect(ops.syncCollection({ appIds: [1.5], recordedId: null })).rejects.toThrow(
      'lbk-ops: invalid appId'
    );
    await expect(ops.syncCollection({ appIds: 'x', recordedId: null })).rejects.toThrow(
      'lbk-ops: invalid appIds'
    );
  });
});

describe('deckyRequestInstall', () => {
  const HASH = 'a'.repeat(64);
  const valid = {
    artifact: 'file:///home/deck/.cache/lbk-launcher/decky/lbk-bridge-1.1.0.zip',
    version: '1.1.0',
    hash: HASH,
    installType: 0,
  };

  function withDecky() {
    const call = vi.fn((..._args: unknown[]) => Promise.resolve(undefined));
    return { call, ops: loadOps({ window: { DeckyBackend: { call } } }) };
  }

  it('asks Decky to show its own install prompt', async () => {
    const { call, ops } = withDecky();
    await expect(ops.deckyRequestInstall(valid)).resolves.toBe('prompted');
    expect(call).toHaveBeenCalledWith(
      'utilities/install_plugin',
      valid.artifact,
      'LBK Bridge',
      '1.1.0',
      HASH,
      0
    );
  });

  it('accepts Fedora-style and Flatpak cache paths', async () => {
    const { call, ops } = withDecky();
    for (const artifact of [
      'file:///var/home/user.name/.cache/lbk-launcher/decky/lbk-bridge-1.1.0.zip',
      'file:///home/deck/.var/app/ua.lbk.Launcher/cache/lbk-launcher/decky/lbk-bridge-1.1.0.zip',
    ]) {
      await expect(
        ops.deckyRequestInstall({ ...valid, artifact, installType: 2 })
      ).resolves.toBe('prompted');
    }
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('rejects any other artifact without calling Decky', async () => {
    const { call, ops } = withDecky();
    for (const artifact of [
      'https://example.com/lbk-bridge-1.1.0.zip',
      'file:///home/deck/.cache/lbk-launcher/decky/lbk-bridge-1.0.0.zip',
      'file:///home/../root/.cache/lbk-launcher/decky/lbk-bridge-1.1.0.zip',
      'file:///home/deck/.cache/lbk-launcher/decky/../../evil/lbk-bridge-1.1.0.zip',
      'file:///etc/lbk-bridge-1.1.0.zip',
      'file:///home/deck/.cache/lbk-launcher/decky/lbk-bridge-1.1.0.zip?x',
      'file:///home/deck/.var/app/../cache/lbk-launcher/decky/lbk-bridge-1.1.0.zip',
    ]) {
      await expect(ops.deckyRequestInstall({ ...valid, artifact })).rejects.toThrow(
        'lbk-ops: invalid artifact'
      );
    }
    expect(call).not.toHaveBeenCalled();
  });

  it('rejects a bad version, hash or install type', async () => {
    const { call, ops } = withDecky();
    await expect(ops.deckyRequestInstall({ ...valid, version: '1.1' })).rejects.toThrow(
      'lbk-ops: invalid version'
    );
    await expect(
      ops.deckyRequestInstall({ ...valid, hash: 'A'.repeat(64) })
    ).rejects.toThrow('lbk-ops: invalid hash');
    await expect(
      ops.deckyRequestInstall({ ...valid, hash: HASH.slice(1) })
    ).rejects.toThrow('lbk-ops: invalid hash');
    for (const installType of [3, -1, 1.5, '0']) {
      await expect(ops.deckyRequestInstall({ ...valid, installType })).rejects.toThrow(
        'lbk-ops: invalid int'
      );
    }
    expect(call).not.toHaveBeenCalled();
  });

  it('answers no-decky when Decky is not injected', async () => {
    await expect(loadOps().deckyRequestInstall(valid)).resolves.toBe('no-decky');
    await expect(loadOps({ window: {} }).deckyRequestInstall(valid)).resolves.toBe(
      'no-decky'
    );
  });
});
