import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InstallationInfo } from '@/shared/types';
import {
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
