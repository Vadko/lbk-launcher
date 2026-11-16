import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/shared/i18n/i18n';
import type { InstallationInfo } from '@/shared/types';
import { droppedFiles, revertDroppedFiles } from './dropped-files';

const userData = vi.hoisted(() => ({ dir: '' }));

vi.mock('electron', () => ({ app: { getPath: () => userData.dir } }));

const record = (components: InstallationInfo['components']): InstallationInfo => ({
  gameId: 'g',
  version: '1.0.0',
  installedAt: '2026-01-01T00:00:00.000Z',
  gamePath: '/games/g',
  installedFiles: [
    ...(components?.text.files ?? []),
    ...(components?.voice?.files ?? []),
  ],
  components,
});

const text = (...files: string[]) => ({ installed: true, files });

// What Kurin's import wrote: `files` holds booleans, not paths.
const kurinText: { installed: boolean; files: string[] } = JSON.parse(
  '{ "installed": true, "files": [true, "game.exe"] }'
);

describe('droppedFiles', () => {
  it.each<[string, InstallationInfo, boolean, boolean, string[], string[]]>([
    [
      'a text file the new version no longer ships',
      record({ text: text('game.exe', 'data.pak') }),
      true,
      false,
      ['data.pak'],
      ['game.exe'],
    ],
    [
      'nothing when every file is shipped again',
      record({ text: text('data.pak') }),
      true,
      false,
      ['data.pak', 'new.pak'],
      [],
    ],
    [
      'nothing from the text when only the voice is reinstalled',
      record({ text: text('game.exe'), voice: text('voice.bank') }),
      false,
      true,
      ['voice.bank'],
      [],
    ],
    [
      'a voice file the new voice archive dropped',
      record({ text: text('game.exe'), voice: text('old.bank', 'voice.bank') }),
      true,
      true,
      ['game.exe', 'voice.bank'],
      ['old.bank'],
    ],
    [
      'a text file the kept voice still lists',
      record({ text: text('shared.ini'), voice: text('shared.ini') }),
      true,
      false,
      [],
      [],
    ],
    [
      'nothing from a component that was not installed',
      record({ text: { installed: false, files: ['game.exe'] } }),
      true,
      false,
      [],
      [],
    ],
    [
      'a file of a legacy record without components',
      { ...record(undefined), installedFiles: ['game.exe', 'data.pak'] },
      true,
      false,
      ['data.pak'],
      ['game.exe'],
    ],
    [
      'only the paths of a Kurin import',
      record({ text: kurinText }),
      true,
      false,
      [],
      ['game.exe'],
    ],
    [
      'nothing outside the game folder',
      record({ text: text(path.join('..', 'other', 'game.exe')) }),
      true,
      false,
      [],
      [],
    ],
  ])('%s', (_, existing, installText, installVoice, nextFiles, expected) => {
    expect(
      droppedFiles('/games/g', existing, { installText, installVoice }, nextFiles)
    ).toEqual(expected);
  });
});

describe('revertDroppedFiles', () => {
  let root: string;
  let game: string;

  const write = (file: string, content: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  const read = (file: string) => fs.readFileSync(path.join(game, file), 'utf-8');
  const exists = (file: string) => fs.existsSync(path.join(game, file));
  const cached = (): InstallationInfo =>
    JSON.parse(
      fs.readFileSync(path.join(userData.dir, 'installation-cache', 'g.json'), 'utf-8')
    );
  const installed = (hasBackup: boolean, ...files: string[]): InstallationInfo => ({
    ...record({ text: text(...files) }),
    gamePath: game,
    hasBackup,
  });

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-dropped-'));
    game = path.join(root, 'game');
    userData.dir = path.join(root, 'user-data');
    fs.mkdirSync(path.join(userData.dir, 'installation-cache'), { recursive: true });
    write(path.join(game, 'data.pak'), 'translated');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('restores a replaced original, deletes an added file and keeps the rest', async () => {
    const exe = path.join('bin', 'game.exe');
    const dll = path.join('mods', 'added.dll');
    write(path.join(game, exe), 'patched');
    write(path.join(game, '.lbk-backup', exe), 'original');
    write(path.join(game, dll), 'added');

    const { record: next, reverted } = await revertDroppedFiles(
      game,
      installed(true, exe, dll, 'data.pak'),
      [exe, dll]
    );

    expect(read(exe)).toBe('original');
    expect(exists('mods')).toBe(false);
    expect(read('data.pak')).toBe('translated');
    expect(exists('.lbk-backup')).toBe(false);
    expect(reverted).toEqual([exe, dll]);
    expect(next.components?.text.files).toEqual(['data.pak']);
    expect(cached().components?.text.files).toEqual(['data.pak']);
    expect(cached().installedFiles).toEqual(['data.pak']);
  });

  it('leaves a file in place when the previous install took no backup', async () => {
    write(path.join(game, 'game.exe'), 'patched');

    const { record: next, reverted } = await revertDroppedFiles(
      game,
      installed(false, 'game.exe', 'data.pak'),
      ['game.exe']
    );

    expect(read('game.exe')).toBe('patched');
    expect(reverted).toEqual([]);
    expect(next.components?.text.files).toEqual(['game.exe', 'data.pak']);
  });

  it('still restores what was backed up when the last install took no backup', async () => {
    write(path.join(game, 'game.exe'), 'patched');
    write(path.join(game, 'game.exe_backup'), 'original');

    await revertDroppedFiles(game, installed(false, 'game.exe', 'data.pak'), [
      'game.exe',
    ]);

    expect(read('game.exe')).toBe('original');
    expect(exists('game.exe_backup')).toBe(false);
  });

  it('rewrites the record in the folder it reverted, not the one it names', async () => {
    write(path.join(game, 'game.exe'), 'patched');
    write(path.join(game, '.lbk-backup', 'game.exe'), 'original');
    const existing = { ...installed(true, 'game.exe', 'data.pak'), gamePath: '/moved' };
    write(path.join(game, '.lbk-translation.json'), JSON.stringify(existing));

    await revertDroppedFiles(game, existing, ['game.exe']);

    const inFolder: InstallationInfo = JSON.parse(read('.lbk-translation.json'));
    expect(inFolder.components?.text.files).toEqual(['data.pak']);
  });

  it('fails while an added file cannot be removed', async () => {
    fs.mkdirSync(path.join(game, 'added.dll', 'busy'), { recursive: true });

    await expect(
      revertDroppedFiles(game, installed(true, 'added.dll', 'data.pak'), ['added.dll'])
    ).rejects.toThrow(t('installSteps.revertFailed', { file: 'added.dll' }));
    expect(cached).toThrow();
  });
});
