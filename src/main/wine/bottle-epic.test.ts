import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bottleEpicGames, bottleEpicRecordDirs } from './bottle-epic';

const GAME_ID = '8649DC294A4BE126063F2CAFB234475A';

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-bottle-epic-')));
const prefix = path.join(root, 'Bottles', 'Epic Bottle');

function installedItems(helper: string): string {
  return path.join(
    prefix,
    'drive_c',
    'ProgramData',
    'Epic',
    helper,
    'InstallHelper',
    'InstalledItems'
  );
}

function writeEgi(helper: string, name: string, v4: Record<string, unknown>): void {
  fs.mkdirSync(installedItems(helper), { recursive: true });
  fs.writeFileSync(
    path.join(installedItems(helper), `${name}.egi`),
    JSON.stringify({ v4 })
  );
}

beforeAll(() => {
  fs.mkdirSync(path.join(prefix, 'drive_c', 'Program Files', 'Epic Games', 'Pit'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(prefix, 'dosdevices'));
  fs.writeFileSync(path.join(prefix, 'system.reg'), '');
  fs.symlinkSync('../drive_c', path.join(prefix, 'dosdevices', 'c:'));
  // EGL 20.3 keeps the games in the Shared helper and only its own EOS components in the other
  writeEgi('EpicOnlineServicesShared', GAME_ID, {
    installationId: GAME_ID,
    state: 'Installed',
    dir: 'C:\\Program Files\\Epic Games\\Pit',
    sandboxId: 'ns',
    itemId: 'item',
    artifactId: 'art',
  });
  writeEgi('EpicOnlineServices', 'service', {
    installationId: 'service',
    state: 'Installed',
    dir: 'C:\\Program Files (x86)\\Epic Games\\Epic Online Services',
  });
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe.skipIf(process.platform === 'win32')(
  'a bottle whose EGL keeps games in the Shared helper',
  () => {
    it('finds the game and its launch id', () => {
      expect(bottleEpicGames(prefix)).toEqual([
        {
          path: path.join(prefix, 'drive_c', 'Program Files', 'Epic Games', 'Pit'),
          launchId: 'ns:item:art',
        },
      ]);
    });

    it('watches both helpers', () => {
      expect(bottleEpicRecordDirs(prefix)).toEqual(
        expect.arrayContaining([
          installedItems('EpicOnlineServicesShared'),
          installedItems('EpicOnlineServices'),
        ])
      );
    });
  }
);
