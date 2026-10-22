import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEpicAppName, getEpicManifestAppId } from './epic';

vi.mock('@/main/utils/platform', () => ({
  isLinux: () => false,
  isMacOS: () => false,
  isWindows: () => true,
}));

const dirs: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function setUpManifests(manifests: Record<string, unknown>[]): void {
  const programData = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-epic-'));
  dirs.push(programData);
  vi.stubEnv('PROGRAMDATA', programData);
  const dir = path.join(programData, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
  fs.mkdirSync(dir, { recursive: true });
  manifests.forEach((manifest, i) => {
    fs.writeFileSync(path.join(dir, `${i}.item`), JSON.stringify(manifest));
  });
}

const GAME_DIR = path.join(os.tmpdir(), 'Epic Games', 'Pit');

describe('getEpicManifestAppId', () => {
  it('takes the game, not a DLC installed into its folder', () => {
    const shared = {
      InstallLocation: GAME_DIR,
      DisplayName: 'Pit',
      MainGameAppName: 'Pit',
    };
    setUpManifests([
      { ...shared, CatalogNamespace: 'ns', CatalogItemId: 'dlc', AppName: 'PitDlc' },
      { ...shared, CatalogNamespace: 'ns', CatalogItemId: 'item', AppName: 'Pit' },
    ]);

    expect(getEpicManifestAppId(GAME_DIR)).toBe('ns:item:Pit');
    expect(getEpicAppName(GAME_DIR)).toBe('Pit');
  });

  it('needs all three ids and a matching folder', () => {
    setUpManifests([
      {
        InstallLocation: GAME_DIR,
        DisplayName: 'Pit',
        CatalogItemId: 'item',
        AppName: 'Pit',
      },
    ]);

    expect(getEpicManifestAppId(GAME_DIR)).toBeNull();
    expect(getEpicManifestAppId(path.join(os.tmpdir(), 'Other'))).toBeNull();
  });
});
