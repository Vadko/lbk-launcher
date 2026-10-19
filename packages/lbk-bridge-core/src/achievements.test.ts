import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAchievements } from './achievements';
import type { SteamApps, SteamGlobals } from './steam-globals';

const NO_TRANSLATIONS = { v: 1, apps: {} };
const READY_TIMEOUT_MS = 5 * 60 * 1000;

const lives: AbortController[] = [];
afterEach(() => {
  for (const life of lives.splice(0)) {
    life.abort();
  }
  vi.useRealTimers();
});

function load(
  steam: SteamGlobals,
  readJson: (name: string) => Promise<unknown>,
  delay: (ms: number) => Promise<void> = () => Promise.resolve()
) {
  const life = new AbortController();
  lives.push(life);
  return createAchievements({
    steam,
    readJson,
    delay,
    signal: life.signal,
    errText: String,
  });
}

const withApps = (): SteamGlobals => ({ SteamClient: { Apps: {} as SteamApps } });

function withSteamUi(): SteamGlobals {
  const steam: SteamGlobals = {
    ...withApps(),
    appDetailsStore: {},
    appDetailsCache: {},
    webpackChunksteamui: [],
  };
  steam.window = steam;
  return steam;
}

describe('achievements startup', () => {
  it('reads achievements.json once more for any number of reloads during a pass', async () => {
    let release: (file: unknown) => void = () => undefined;
    const readJson = vi
      .fn<(name: string) => Promise<unknown>>()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          release = resolve;
        })
      )
      .mockResolvedValue(NO_TRANSLATIONS);
    const achievements = load(withSteamUi(), readJson);

    achievements.start();
    await vi.waitFor(() => expect(readJson).toHaveBeenCalledOnce());
    for (let i = 0; i < 3; i++) {
      await expect(achievements.ops.achievementsReload({})).resolves.toEqual({
        apps: 0,
        coverage: {},
      });
    }
    release(NO_TRANSLATIONS);

    await vi.waitFor(() => expect(readJson).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(readJson).toHaveBeenCalledTimes(2);
    expect(achievements.report().state).toBe('ok');
  });

  it('gives up on the full Steam UI at the deadline, then needs only SteamClient.Apps', async () => {
    const readJson = vi.fn(() => Promise.resolve<unknown>(NO_TRANSLATIONS));
    const bare = load({}, readJson);
    const apps = load(withApps(), readJson);
    vi.setSystemTime(Date.now() + READY_TIMEOUT_MS);

    bare.start();
    apps.start();
    await vi.waitFor(() =>
      expect(bare.report()).toMatchObject({
        state: 'failed',
        error: 'steam ui not ready',
      })
    );
    await vi.waitFor(() => expect(apps.report().state).toBe('ok'));
    expect(readJson).toHaveBeenCalledOnce();
  });

  it('reads achievements.json three times 2 s apart before it reports the error', async () => {
    const readJson = vi.fn(() => Promise.reject(new Error('fetch failed')));
    const delay = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const achievements = load(withSteamUi(), readJson, delay);

    achievements.start();
    await vi.waitFor(() =>
      expect(achievements.report()).toMatchObject({
        state: 'failed',
        error: 'Error: fetch failed',
      })
    );
    expect(readJson).toHaveBeenCalledTimes(3);
    expect(delay.mock.calls).toEqual([[2000], [2000]]);
  });
});

describe('achievement strings for Steam web pages', () => {
  const FILE = { v: 1, apps: { 620: { 'ACH.WAKE_UP': { name: 'Підйом' } } } };

  it.each([
    ['620', { 'ACH.WAKE_UP': { name: 'Підйом' } }],
    ['400', undefined],
    ['constructor', undefined],
  ])(
    'reads achievements.json itself while the Steam UI never gets ready: %s',
    async (appid, expected) => {
      const readJson = vi.fn(() => Promise.resolve<unknown>(FILE));
      const achievements = load({}, readJson);
      achievements.start();
      await expect(achievements.strings(appid)).resolves.toEqual(expected);
      expect(readJson).toHaveBeenCalledWith('achievements.json');
    }
  );

  it('shares one read between asks and answers nothing when it fails', async () => {
    const readJson = vi.fn(() => Promise.reject(new Error('fetch failed')));
    const achievements = load({}, readJson);
    await expect(
      Promise.all([achievements.strings('620'), achievements.strings('400')])
    ).resolves.toEqual([undefined, undefined]);
    expect(readJson).toHaveBeenCalledOnce();
  });

  it("gives the hook's read once it has one", async () => {
    const readJson = vi.fn(() => Promise.resolve<unknown>(FILE));
    const achievements = load(withSteamUi(), readJson);
    achievements.start();
    await vi.waitFor(() => expect(achievements.report().state).toBe('ok'));
    readJson.mockClear();
    await expect(achievements.strings('620')).resolves.toEqual(FILE.apps[620]);
    expect(readJson).not.toHaveBeenCalled();
  });
});
