import { describe, expect, it } from 'vitest';
import {
  mergeLaunchOptions,
  resolveGameDirToken,
  usesGameDirToken,
} from './launch-options-value';

// Each case is a bug that actually reached this file, kept so it can't return.

const WINDOWS_TEMPLATE = '"{GAME_DIR}\\StardewModdingAPI.exe" %command%';
const SPACED_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Stardew Valley';

describe('usesGameDirToken', () => {
  it('recognises the token regardless of case', () => {
    expect(usesGameDirToken('{GAME_DIR}/x')).toBe(true);
    expect(usesGameDirToken('{game_dir}/x')).toBe(true);
  });

  it('returns the same answer when asked twice', () => {
    // A `g` flag on the test regex would advance lastIndex and alternate.
    const value = '"{GAME_DIR}/x" %command%';
    expect(usesGameDirToken(value)).toBe(usesGameDirToken(value));
  });

  it('is false for values without the token', () => {
    expect(usesGameDirToken('%command% -windowed')).toBe(false);
    expect(usesGameDirToken(null)).toBe(false);
    expect(usesGameDirToken('')).toBe(false);
  });
});

describe('resolveGameDirToken', () => {
  it('passes through a value that has no token', () => {
    expect(resolveGameDirToken('%command% -windowed', null)).toEqual({
      value: '%command% -windowed',
    });
  });

  it('refuses when the game folder is unknown', () => {
    expect(resolveGameDirToken(WINDOWS_TEMPLATE, null).value).toBeNull();
  });

  it('expands a quoted token into a path with spaces', () => {
    expect(resolveGameDirToken(WINDOWS_TEMPLATE, SPACED_PATH).value).toBe(
      `"${SPACED_PATH}\\StardewModdingAPI.exe" %command%`
    );
  });

  it('refuses an unquoted token when the path has spaces', () => {
    // Steam splits on whitespace, so this would launch `C:\Program` instead.
    expect(
      resolveGameDirToken('{GAME_DIR}\\loader.exe %command%', SPACED_PATH).value
    ).toBeNull();
  });

  it('allows an unquoted token when the path has no spaces', () => {
    expect(resolveGameDirToken('{GAME_DIR}/loader %command%', '/games/sdv').value).toBe(
      '/games/sdv/loader %command%'
    );
  });

  it('resolves a lower-case token', () => {
    expect(resolveGameDirToken('"{game_dir}/loader" %command%', '/games/sdv').value).toBe(
      '"/games/sdv/loader" %command%'
    );
  });

  it('strips a trailing separator', () => {
    expect(
      resolveGameDirToken('"{GAME_DIR}/loader" %command%', '/games/sdv/').value
    ).toBe('"/games/sdv/loader" %command%');
  });

  it('treats $-sequences in the path as literal text', () => {
    // `$&` and `` $` `` are replacement patterns; a folder may contain them.
    expect(resolveGameDirToken('"{GAME_DIR}/loader"', '/games/$&x').value).toBe(
      '"/games/$&x/loader"'
    );
    expect(resolveGameDirToken('"{GAME_DIR}/loader"', '/games/$`evil').value).toBe(
      '"/games/$`evil/loader"'
    );
  });

  it('keeps the separator on a bare drive root', () => {
    // `D:` alone means "current directory on D:" to Windows, not the root.
    expect(resolveGameDirToken('"{GAME_DIR}loader.exe" %command%', 'D:\\').value).toBe(
      '"D:\\loader.exe" %command%'
    );
  });
});

describe('mergeLaunchOptions', () => {
  it('uses our value when nothing is set', () => {
    expect(mergeLaunchOptions('', 'A %command%')).toBe('A %command%');
    expect(mergeLaunchOptions(null, 'A %command%')).toBe('A %command%');
  });

  it('is idempotent', () => {
    expect(mergeLaunchOptions('A %command%', 'A %command%')).toBe('A %command%');
  });

  it('replaces our own wrapper when the game moves, without accumulating', () => {
    const merged = mergeLaunchOptions(
      '"C:\\Old\\StardewModdingAPI.exe" %command%',
      '"D:\\New\\StardewModdingAPI.exe" %command%'
    );
    expect(merged).toBe('"D:\\New\\StardewModdingAPI.exe" %command%');
    expect(merged).not.toContain('C:\\Old');
  });

  it("keeps the player's own flags when the wrapper is replaced", () => {
    const merged = mergeLaunchOptions(
      '"C:\\Old\\StardewModdingAPI.exe" %command% -skipintro',
      '"D:\\New\\StardewModdingAPI.exe" %command%'
    );
    expect(merged).toContain('-skipintro');
    expect(merged).not.toContain('C:\\Old');
  });

  it('splices plain flags into our args zone', () => {
    expect(mergeLaunchOptions('-windowed', 'WRAP %command%')).toBe(
      'WRAP %command% -windowed'
    );
  });
});
