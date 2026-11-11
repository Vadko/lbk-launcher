import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/shared/i18n/i18n';
import type { Game, InstallationInfo } from '@/shared/types';
import { applySteamIntegration, setInstalledSteamArtwork } from './steam-integration';

const mocks = vi.hoisted(() => ({
  applySteamArtwork: vi.fn(),
  removeSteamArtwork: vi.fn(),
  checkInstallation: vi.fn(),
  rewriteInstallationRecord: vi.fn(),
}));

vi.mock('@/main/utils/steam-artwork', () => ({
  applySteamArtwork: mocks.applySteamArtwork,
  removeSteamArtwork: mocks.removeSteamArtwork,
}));
vi.mock('@/main/utils/steam-launch-options', () => ({
  launchOptionsParamsFor: () => null,
  writeSteamLaunchOptions: vi.fn(),
}));
vi.mock('@/main/installer/cache', () => ({
  checkInstallation: mocks.checkInstallation,
}));
vi.mock('@/main/installer/installation-info', () => ({
  rewriteInstallationRecord: mocks.rewriteInstallationRecord,
}));
vi.mock('@/main/steam-pending-actions', () => ({ queueSteamAction: vi.fn() }));
vi.mock('@/main/wine/bottle-steam', () => ({
  artworkTargetForGame: () => undefined,
  writeBottleLaunchOptions: vi.fn(),
}));
vi.mock('@/main/wine/bottle-steam-roots', () => ({ bottleSteamOf: () => null }));
vi.mock('@/main/game-detector/steam', () => ({
  getCurrentSteamAccountId: () => null,
}));

const APP_ID = 1332010;
const STEAM = { platform: 'steam' as const, path: '/games/Stray' };

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: 'stray',
    steam_app_id: APP_ID,
    capsule_path: 'stray/capsule.webp',
    banner_path: 'stray/banner.webp',
    logo_path: null,
    artwork_localized: true,
    updated_at: '2026-01-01T00:00:00+00:00',
    ...overrides,
  } as Game;
}

const record = (overrides: Partial<InstallationInfo> = {}) =>
  ({ gameId: 'stray', installedPlatform: 'steam', ...overrides }) as InstallationInfo;

const notOffered: [string, Game][] = [
  ['artwork that is not localized', game({ artwork_localized: false })],
  ['no images', game({ capsule_path: null, banner_path: null })],
];

beforeEach(() => {
  mocks.applySteamArtwork.mockResolvedValue({ mode: 'cef', installed: ['capsule'] });
  mocks.removeSteamArtwork.mockResolvedValue('cef');
  mocks.checkInstallation.mockResolvedValue(record());
  mocks.rewriteInstallationRecord.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('applySteamIntegration', () => {
  it('applies the artwork of a game that offers it', async () => {
    await applySteamIntegration(game(), STEAM, true);
    expect(mocks.applySteamArtwork).toHaveBeenCalledWith(
      {
        appId: APP_ID,
        capsulePath: 'stray/capsule.webp',
        bannerPath: 'stray/banner.webp',
        logoPath: null,
        updatedAt: '2026-01-01T00:00:00+00:00',
      },
      undefined
    );
    expect(mocks.removeSteamArtwork).not.toHaveBeenCalled();
  });

  it('removes the artwork when the option is off', async () => {
    await applySteamIntegration(game(), STEAM, false);
    expect(mocks.removeSteamArtwork).toHaveBeenCalledWith(APP_ID, undefined);
    expect(mocks.applySteamArtwork).not.toHaveBeenCalled();
  });

  it.each(notOffered)('removes applied artwork for %s', async (_case, row) => {
    await applySteamIntegration(row, STEAM, true);
    expect(mocks.removeSteamArtwork).toHaveBeenCalledWith(APP_ID, undefined);
    expect(mocks.applySteamArtwork).not.toHaveBeenCalled();
    expect(mocks.rewriteInstallationRecord).not.toHaveBeenCalled();
  });

  it('leaves Steam alone for an install from another store', async () => {
    await applySteamIntegration(game(), { platform: 'epic', path: '/games/Stray' }, true);
    expect(mocks.applySteamArtwork).not.toHaveBeenCalled();
    expect(mocks.removeSteamArtwork).not.toHaveBeenCalled();
  });
});

describe('setInstalledSteamArtwork', () => {
  it('applies the artwork and records the choice', async () => {
    const info = record({ steamArtwork: false });
    mocks.checkInstallation.mockResolvedValue(info);

    expect(await setInstalledSteamArtwork(game(), true)).toEqual({
      success: true,
      visibleAfterSteamStart: false,
    });
    expect(mocks.applySteamArtwork).toHaveBeenCalledTimes(1);
    const [rewritten, update] = mocks.rewriteInstallationRecord.mock.calls[0];
    expect(rewritten).toBe(info);
    expect(update(info)).toEqual({ ...info, steamArtwork: true });
  });

  it.each(notOffered)('refuses to apply for %s', async (_case, row) => {
    expect(await setInstalledSteamArtwork(row, true)).toEqual({
      success: false,
      error: t('installSteamIntegration.artworkFailed'),
    });
    expect(mocks.applySteamArtwork).not.toHaveBeenCalled();
    expect(mocks.removeSteamArtwork).not.toHaveBeenCalled();
    expect(mocks.rewriteInstallationRecord).not.toHaveBeenCalled();
  });

  it('still removes artwork of a game that no longer offers it', async () => {
    expect(
      await setInstalledSteamArtwork(game({ artwork_localized: false }), false)
    ).toEqual({ success: true, visibleAfterSteamStart: false });
    expect(mocks.removeSteamArtwork).toHaveBeenCalledWith(APP_ID, undefined);
  });

  it('refuses a record of another store', async () => {
    mocks.checkInstallation.mockResolvedValue(record({ installedPlatform: 'epic' }));
    expect(await setInstalledSteamArtwork(game(), true)).toEqual({
      success: false,
      error: t('installSteamIntegration.artworkNotSteam'),
    });
    expect(mocks.applySteamArtwork).not.toHaveBeenCalled();
  });
});
