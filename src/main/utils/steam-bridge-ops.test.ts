import vm from 'node:vm';
import { SHARED_STEAM_OPS } from '@lbk/bridge-core/contract';
import { describe, expect, it, vi } from 'vitest';
import { STEAM_OPS_SOURCE } from '@/main/utils/steam-bridge-ops';

type OpFn = (args: unknown) => Promise<unknown>;

interface FakeApp {
  appid: number;
  display_name?: string;
}

interface FakeCollection {
  id: string;
  allApps: FakeApp[];
}

const COLLECTION_NAME = 'With Ukrainian translations';
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
      AddShortcut: vi.fn((..._args: unknown[]) =>
        Promise.resolve<number | undefined>(SHORTCUT_ID)
      ),
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
  // LBK sends the whole bundle with every CDP call.
  it('stays small', () => {
    expect(STEAM_OPS_SOURCE.length).toBeLessThan(24 * 1024);
  });

  it('exposes exactly the shared ops', () => {
    const ops = loadOps();
    expect(Object.keys(ops).sort()).toEqual([...SHARED_STEAM_OPS].sort());
  });

  it('runs without any Steam globals for ping', async () => {
    const ops = loadOps();
    await expect(ops.ping({})).resolves.toEqual({ ok: true });
  });
});

describe('validators', () => {
  const steam = makeSteamClient();
  const ops = loadOps({
    SteamClient: steam,
    collectionStore: makeCollectionStore(library, []),
  });
  const artwork = { appId: 10, base64: 'iVBORw0KGgo=', ext: 'png', assetType: 1 };
  const shortcut = {
    appId: 10,
    exe: '"a"',
    startDir: '"b"',
    icon: 'c',
    launchOptions: '',
  };

  it.each([
    ['setLaunchOptions', 'invalid appId', { appId: 10.5, value: '' }],
    ['clearArtwork', 'invalid appId', { appId: 0, assetType: 1 }],
    ['clearArtwork', 'invalid appId', { appId: 2 ** 32, assetType: 1 }],
    ['workshopSubscribe', 'invalid id', { appId: 10, itemId: '12a', subscribe: true }],
    ['workshopSubscribe', 'invalid id', { appId: 10, itemId: 12, subscribe: true }],
    [
      'workshopDownloaded',
      'invalid id',
      { targets: [{ id: 'g', appId: 10, itemId: '1);' }] },
    ],
    ['workshopSubscribe', 'invalid flag', { appId: 10, itemId: '1', subscribe: 'true' }],
    [
      'addShortcut',
      'invalid text',
      { exe: 'x'.repeat(4097), startDir: '', launchOptions: '' },
    ],
    ['setLaunchOptions', 'invalid text', { appId: 10, value: 'x'.repeat(32769) }],
    ['setArtwork', 'invalid base64', { ...artwork, base64: 'abc"def' }],
    ['setArtwork', 'invalid base64', { ...artwork, base64: '' }],
    ['setArtwork', 'invalid ext', { ...artwork, ext: 'gif' }],
    ['setArtwork', 'invalid int', { ...artwork, assetType: 5 }],
    ['clearArtwork', 'invalid int', { appId: 10, assetType: 5 }],
    ['updateShortcut', 'invalid shortcut appId', shortcut],
    ['setLaunchOptions', 'invalid args', null],
    [
      'syncCollection',
      'invalid appId',
      { name: COLLECTION_NAME, appIds: [1.5], recordedId: null },
    ],
    ['syncCollection', 'invalid text', { appIds: [10], recordedId: null }],
    ['syncCollection', 'invalid name', { name: '', appIds: [10], recordedId: null }],
    [
      'syncCollection',
      'invalid appIds',
      { name: COLLECTION_NAME, appIds: 'x', recordedId: null },
    ],
  ])('%s fails with "%s" without touching Steam (#%#)', async (op, error, args) => {
    await expect(ops[op](args)).rejects.toThrow(`lbk-ops: ${error}`);
    for (const call of Object.values(steam.Apps)) {
      expect(call).not.toHaveBeenCalled();
    }
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

    steam.Apps.AddShortcut.mockResolvedValueOnce(undefined);
    await expect(
      ops.addShortcut({ exe: '"/a/lbk"', startDir: '"/a"', launchOptions: '' })
    ).rejects.toThrow('AddShortcut returned undefined');
  });
});

describe('syncCollection', () => {
  it('reports an unavailable library, then no-matches when nothing is owned', async () => {
    await expect(
      loadOps().syncCollection({ name: COLLECTION_NAME, appIds: [10], recordedId: null })
    ).resolves.toBe('library-unavailable');
    const store = makeCollectionStore(library, []);
    const ops = loadOps({ collectionStore: store });
    await expect(
      ops.syncCollection({ name: COLLECTION_NAME, appIds: [99], recordedId: null })
    ).resolves.toBe('no-matches');
    expect(store.SaveCollection).not.toHaveBeenCalled();
  });

  it('creates a manual collection with the owned games', async () => {
    const store = makeCollectionStore(library, []);
    const ops = loadOps({ collectionStore: store });
    const result = await ops.syncCollection({
      name: COLLECTION_NAME,
      appIds: [10, 20, 99],
      recordedId: null,
    });
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
    const result = await ops.syncCollection({
      name: COLLECTION_NAME,
      appIds: [10, 20],
      recordedId: 'uc-1',
    });
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
    const result = await ops.syncCollection({
      name: COLLECTION_NAME,
      appIds: [10, 30],
      recordedId: null,
    });
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
    const result = await ops.syncCollection({
      name: COLLECTION_NAME,
      appIds: [10],
      recordedId: null,
    });
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
      ops.syncCollection({ name: COLLECTION_NAME, appIds: [10], recordedId: 'uc-4' })
    ).resolves.toEqual({
      error: 'steam said no',
    });
  });
});
