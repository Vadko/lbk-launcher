// The package root's types patch Array.join globally, which breaks the Supabase types
import parse from 'shell-quote/parse';

const ENV_ASSIGNMENT = /^([A-Za-z_]\w*)=(.*)$/s;
const COMMAND_TOKEN = '%command%';

export interface LaunchCommand {
  env: Record<string, string>;
  args: string[];
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
    return { env: {}, args: tokens };
  }
  const assignments = tokens.slice(0, command).map((token) => ENV_ASSIGNMENT.exec(token));
  if (!assignments.every((match) => match !== null)) {
    return null;
  }
  return {
    env: Object.fromEntries(assignments.map(([, key, val]) => [key, val])),
    args: tokens.slice(command + 1),
  };
}
