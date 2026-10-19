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
