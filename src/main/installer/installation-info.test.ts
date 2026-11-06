import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InstallationInfo } from '@/shared/types';
import {
  keepInstalledText,
  listInstallationRecords,
  rewriteInstallationRecord,
  withAchievementsComponent,
} from './installation-info';

const userData = vi.hoisted(() => ({ dir: '/user-data' }));

vi.mock('electron', () => ({ app: { getPath: () => userData.dir } }));

const base: InstallationInfo = {
  gameId: 'g',
  version: '1.0.0',
  installedAt: '2026-01-01T00:00:00.000Z',
  gamePath: '/games/g',
  installerPath: '/games/g/setup.exe',
  installedFiles: [],
  components: {
    text: { installed: true, files: [] },
    achievements: { installed: true, files: [], appIds: [1] },
  },
};

describe('withAchievementsComponent', () => {
  it('keeps the installer-based record and swaps only the achievements', () => {
    const next = withAchievementsComponent(base, {
      installed: true,
      files: [],
      appIds: [2],
    });
    expect(next.installerPath).toBe('/games/g/setup.exe');
    expect(next.components?.text).toEqual({ installed: true, files: [] });
    expect(next.components?.achievements?.appIds).toEqual([2]);
  });

  it('drops the achievements entry when none are kept', () => {
    expect(withAchievementsComponent(base, null).components).toEqual({
      text: { installed: true, files: [] },
    });
  });
});

describe('keepInstalledText', () => {
  const installed: InstallationInfo = {
    gameId: 'g',
    version: '1.0.0',
    installedAt: '2026-01-01T00:00:00.000Z',
    gamePath: '/games/g',
    hasBackup: true,
    installedFiles: ['data/text.pak', 'data/voice.pak'],
    installedPlatform: 'steam',
    components: {
      text: { installed: true, files: ['data/text.pak'] },
      voice: { installed: true, files: ['data/voice.pak'] },
      achievements: { installed: true, files: [], appIds: [1] },
    },
  };
  const withoutText = (patch: Partial<InstallationInfo>): InstallationInfo => ({
    gameId: 'g',
    version: '2.0.0',
    installedAt: '2026-02-01T00:00:00.000Z',
    gamePath: '/games/g',
    hasBackup: false,
    installedFiles: [],
    installedPlatform: 'steam',
    components: { text: { installed: false, files: [] } },
    ...patch,
  });

  it.each([
    [
      'achievements only',
      withoutText({
        components: {
          text: { installed: false, files: [] },
          achievements: { installed: true, files: [], appIds: [2] },
        },
      }),
      {
        installedFiles: ['data/text.pak', 'data/voice.pak'],
        components: {
          text: { installed: true, files: ['data/text.pak'] },
          voice: { installed: true, files: ['data/voice.pak'] },
          achievements: { installed: true, files: [], appIds: [2] },
        },
      },
    ],
    [
      'voice re-copied',
      withoutText({
        hasBackup: true,
        installedFiles: ['data/voice.pak', 'data/voice2.pak'],
        components: {
          text: { installed: false, files: [] },
          voice: { installed: true, files: ['data/voice.pak', 'data/voice2.pak'] },
        },
      }),
      {
        installedFiles: ['data/text.pak', 'data/voice.pak', 'data/voice2.pak'],
        components: {
          text: { installed: true, files: ['data/text.pak'] },
          voice: { installed: true, files: ['data/voice.pak', 'data/voice2.pak'] },
        },
      },
    ],
  ])('%s keeps the installed text', (_, record, expected) => {
    expect(keepInstalledText(record, installed)).toMatchObject({
      version: '1.0.0',
      installedAt: '2026-02-01T00:00:00.000Z',
      hasBackup: true,
      ...expected,
    });
  });

  it('drops achievements the install no longer keeps', () => {
    expect(keepInstalledText(withoutText({}), installed).components).toEqual({
      text: { installed: true, files: ['data/text.pak'] },
      voice: { installed: true, files: ['data/voice.pak'] },
    });
  });
});

describe('record rewrite', () => {
  afterEach(() => {
    fs.rmSync(userData.dir, { recursive: true, force: true });
  });

  it('keeps fields another LBK version wrote in both copies', async () => {
    userData.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-records-'));
    const gamePath = path.join(userData.dir, 'game');
    const cacheDir = path.join(userData.dir, 'installation-cache');
    fs.mkdirSync(gamePath);
    fs.mkdirSync(cacheDir);
    const written = {
      ...base,
      gamePath,
      future: { kept: true },
      components: { text: { installed: true, files: [], future: 1 } },
    };
    for (const file of [
      path.join(cacheDir, 'g.json'),
      path.join(gamePath, '.lbk-translation.json'),
    ]) {
      fs.writeFileSync(file, JSON.stringify(written));
    }
    fs.writeFileSync(path.join(cacheDir, 'other.json'), JSON.stringify(written));

    const records = listInstallationRecords();
    expect(records).toEqual([written]);
    await rewriteInstallationRecord(records[0], (info) => ({
      ...info,
      version: '2.0.0',
    }));

    for (const file of [
      path.join(cacheDir, 'g.json'),
      path.join(gamePath, '.lbk-translation.json'),
    ]) {
      expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({
        ...written,
        version: '2.0.0',
      });
    }
  });
});
