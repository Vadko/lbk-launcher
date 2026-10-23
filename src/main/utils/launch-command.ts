// The package root's types patch Array.join globally, which breaks the Supabase types
import parse from 'shell-quote/parse';
import { resolveGameDirToken } from './launch-options-value';

const ENV_ASSIGNMENT = /^([A-Za-z_]\w*)=(.*)$/s;
const COMMAND_TOKEN = '%command%';
const RAW_COMMAND = /(?:^|\s)%command%(?=\s|$)/;

export interface LaunchCommand {
  env: Record<string, string>;
  args: string[];
  // The args as written, so they can be handed on without re-quoting
  argsText: string;
}

// Steam's `VAR=x %command% args` outside Steam; wrappers and shell operators have no shell to run in here
export function parseLaunchCommand(value: string): LaunchCommand | null {
  const tokens = parse(value, (key) => `$${key}`);
  if (!tokens.every((token): token is string => typeof token === 'string')) {
    return null;
  }
  // %command% inside a quoted wrapper argument (`cmd /c "… %command%"`)
  if (tokens.some((token) => token !== COMMAND_TOKEN && token.includes(COMMAND_TOKEN))) {
    return null;
  }
  const command = tokens.indexOf(COMMAND_TOKEN);
  if (command === -1) {
    return { env: {}, args: tokens, argsText: value.trim() };
  }
  const assignments = tokens.slice(0, command).map((token) => ENV_ASSIGNMENT.exec(token));
  // A quoted "%command%" leaves no clean point to cut the raw args at
  const bare = RAW_COMMAND.exec(value);
  if (!bare || !assignments.every((match) => match !== null)) {
    return null;
  }
  return {
    env: Object.fromEntries(assignments.map(([, key, val]) => [key, val])),
    args: tokens.slice(command + 1),
    argsText: value.slice(bare.index + bare[0].length).trim(),
  };
}

export function parseCatalogLaunchOptions(
  value: string,
  gameDir: string
): LaunchCommand | null {
  const resolved = resolveGameDirToken(value, gameDir);
  return resolved.value === null ? null : parseLaunchCommand(resolved.value);
}
