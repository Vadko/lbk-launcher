import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { readTextOrNull } from '@/main/utils/fs-safe';
import { isWinePrefix } from './dos-path';

const execFileAsync = promisify(execFile);

const CROSSOVER_APPS = [
  '/Applications/CrossOver.app',
  path.join(os.homedir(), 'Applications/CrossOver.app'),
  '/Applications/CrossOver Preview.app',
];

const WINE_IN_APP = 'Contents/SharedSupport/CrossOver/bin/wine';

const USER_CONF = path.join(
  os.homedir(),
  'Library/Application Support/CrossOver/CrossOver.conf'
);

const DEFAULT_BOTTLE_DIR = path.join(
  os.homedir(),
  'Library/Application Support/CrossOver/Bottles'
);

export function findCrossOverWine(): string | null {
  return (
    CROSSOVER_APPS.map((app) => path.join(app, WINE_IN_APP)).find((wine) =>
      fs.existsSync(wine)
    ) ?? null
  );
}

export function parseBottlePath(conf: string): string[] {
  let inSection = false;
  const dirs: string[] = [];
  for (const raw of conf.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('[')) {
      inSection = line === '[CrossOver]';
      continue;
    }
    const value = inSection ? /^"BottlePath"\s*=\s*"(.*)"$/.exec(line)?.[1] : undefined;
    if (value) {
      dirs.push(...value.split(':').filter(Boolean));
    }
  }
  return dirs;
}

/** Bottle folders CrossOver reads without its GUI: the env override, CrossOver.conf and the default folder. */
export function crossOverBottleDirs(): string[] {
  const fromEnv = (process.env.CX_BOTTLE_PATH ?? '').split(':').filter(Boolean);
  const fromConf = parseBottlePath(readTextOrNull(USER_CONF) ?? '');
  return [...fromEnv, ...fromConf, DEFAULT_BOTTLE_DIR];
}

// The GUI keeps a custom bottle folder (Settings → System Integration) as a user default the CLI never reads.
export async function readCrossOverBottleDirDefault(): Promise<string | null> {
  const { stdout } = await execFileAsync(
    '/usr/bin/defaults',
    ['read', 'com.codeweavers.CrossOver', 'BottleDir'],
    { timeout: 5000 }
  ).catch(() => ({ stdout: '' }));
  const dir = stdout.trim();
  return dir ? dir.replace(/^~(?=\/|$)/, os.homedir()) : null;
}

/** Bottles of one folder; `default` is CrossOver's symlink to the default bottle. */
export function listBottlesIn(dir: string): string[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.toLowerCase() !== 'default')
    .map((entry) => path.join(dir, entry))
    .filter(isWinePrefix);
}

export function isCrossOverBottle(prefix: string): boolean {
  return fs.existsSync(path.join(prefix, 'cxbottle.conf'));
}
