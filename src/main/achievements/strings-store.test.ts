import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { removeStringsOwnedBy, saveAchievementStrings } from './strings-store';

const state = vi.hoisted(() => ({ root: '' }));

vi.mock('electron', () => ({
  app: { getPath: () => path.join(state.root, 'userData') },
}));

const stringsFile = () =>
  path.join(state.root, 'userData', 'achievement-strings', '900.json');
const gamePath = () => path.join(state.root, 'drive', 'common', 'Game');

beforeEach(() => {
  state.root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-strings-'));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(state.root, { recursive: true, force: true });
});

describe('strings of a dropped record', () => {
  it.each<[string, () => void, boolean]>([
    [
      'a folder that exists without the translation',
      () => fs.mkdirSync(gamePath(), { recursive: true }),
      true,
    ],
    [
      'a folder deleted from a mounted drive',
      () => fs.mkdirSync(path.dirname(gamePath()), { recursive: true }),
      true,
    ],
    ['a folder on an unmounted drive', () => undefined, false],
    [
      'strings saved without their game folder',
      () => {
        const saved = JSON.parse(fs.readFileSync(stringsFile(), 'utf8'));
        delete saved.gamePath;
        fs.writeFileSync(stringsFile(), JSON.stringify(saved));
      },
      true,
    ],
  ])('%s', (_case, arrange, removed) => {
    saveAchievementStrings(
      [{ appId: 900, strings: { ACH: { name: 'Card' } } }],
      { gameId: 'game-c', gamePath: gamePath() },
      'h'
    );
    arrange();

    expect(removeStringsOwnedBy(new Set(['game-c']))).toBe(removed);
    expect(fs.existsSync(stringsFile())).toBe(!removed);
  });

  it('leaves the strings of other games', () => {
    fs.mkdirSync(gamePath(), { recursive: true });
    saveAchievementStrings(
      [{ appId: 900, strings: { ACH: { name: 'Card' } } }],
      { gameId: 'game-d', gamePath: gamePath() },
      'h'
    );

    expect(removeStringsOwnedBy(new Set(['game-c']))).toBe(false);
    expect(fs.existsSync(stringsFile())).toBe(true);
  });
});
