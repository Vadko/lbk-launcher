/**
 * Steam LaunchOptions string handling: expanding `{GAME_DIR}` and merging with
 * whatever the player already had. Import-free so it stays unit-testable.
 */

const COMMAND_TOKEN = '%command%';

/** Stand-in for the install folder, so translators don't hard-code a path. */
const GAME_DIR_TOKEN = '{GAME_DIR}';

// Two constants on purpose: `.test()` on a `g` regex advances `lastIndex`.
const GAME_DIR_TEST = /\{GAME_DIR\}/i;
const GAME_DIR_PATTERN = /\{GAME_DIR\}/gi;

/** True when a value needs a game folder to be resolvable. */
export function usesGameDirToken(value: string | null | undefined): boolean {
  return !!value && GAME_DIR_TEST.test(value);
}

type TokenResolution = { value: string } | { value: null; reason: string };

/**
 * Substitute `{GAME_DIR}`. Returns a reason instead of a value when the token
 * cannot be expanded safely.
 */
export function resolveGameDirToken(
  value: string,
  gamePath: string | null
): TokenResolution {
  if (!usesGameDirToken(value)) {
    return { value };
  }
  if (!gamePath) {
    return {
      value: null,
      reason: `Launch options use ${GAME_DIR_TOKEN} but the game folder is unknown`,
    };
  }

  // Trailing separators would double up against the token's own separator, but
  // a bare drive root (`D:\`) must keep it: `D:` means "current directory on
  // D:" to Windows, not the root.
  const base = /^[a-zA-Z]:[\\/]$/.test(gamePath)
    ? gamePath
    : gamePath.replace(/[/\\]+$/, '');

  if (/\s/.test(base) && hasUnquotedToken(value)) {
    return {
      value: null,
      reason:
        `${GAME_DIR_TOKEN} is not quoted and the game path contains spaces — ` +
        `Steam would split the command. Write it as "${GAME_DIR_TOKEN}\\your-file.exe"`,
    };
  }

  // Replacer function, not a string: `$&`, `` $` `` and `$1` are substitution
  // patterns, and a game folder is free to contain them.
  return { value: value.replace(GAME_DIR_PATTERN, () => base) };
}

/**
 * Steam splits on whitespace, so an unquoted token expands into a command it
 * tears apart. We can't quote it here — the token sits inside a larger argument
 * and wrapping it alone gives `"C:\dir"\loader.exe` — so the value is refused.
 */
function hasUnquotedToken(value: string): boolean {
  const pattern = new RegExp(GAME_DIR_PATTERN.source, 'gi');

  for (let match = pattern.exec(value); match; match = pattern.exec(value)) {
    // An odd number of quotes before the token means it sits inside one.
    const quotesBefore = (value.slice(0, match.index).match(/"/g) ?? []).length;
    if (quotesBefore % 2 === 0) {
      return true;
    }
  }

  return false;
}

/**
 * Merge our value with the player's. `%command%` splits the string into
 * `<wrappers> %command% <game args>`: their args are kept, their wrapper is
 * replaced (two can't co-exist). Idempotent, so re-installs don't duplicate.
 */
export function mergeLaunchOptions(existing: string | null, ours: string): string {
  const existingTrim = (existing ?? '').trim();
  if (!existingTrim) {
    return ours;
  }
  if (existingTrim === ours) {
    return existingTrim;
  }
  if (existingTrim.includes(ours)) {
    return existingTrim;
  }

  if (ours.includes(COMMAND_TOKEN)) {
    // Extract whatever args the player had after their own %command% (if any),
    // otherwise treat the whole existing string as plain args.
    const userArgs = existingTrim.includes(COMMAND_TOKEN)
      ? existingTrim
          .slice(existingTrim.indexOf(COMMAND_TOKEN) + COMMAND_TOKEN.length)
          .trim()
      : existingTrim;

    if (!userArgs) {
      return ours;
    }
    if (ours.includes(userArgs)) {
      return ours;
    }
    return ours.replace(COMMAND_TOKEN, `${COMMAND_TOKEN} ${userArgs}`);
  }

  return `${existingTrim} ${ours}`;
}
