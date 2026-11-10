import { spawn } from 'node:child_process';
import { once } from 'node:events';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { WinePrefixRef } from '@/shared/wine-types';
import { findCrossOverWine } from './crossover';
import { hostToWinePath } from './dos-path';

const STANDALONE_WINES = [
  '/opt/homebrew/bin/wine',
  '/opt/homebrew/bin/wine64',
  '/usr/local/bin/wine',
  '/usr/local/bin/wine64',
  '/Applications/Wine Stable.app/Contents/Resources/wine/bin/wine',
  '/Applications/Wine Devel.app/Contents/Resources/wine/bin/wine',
];

interface WineCommand {
  file: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

function findStandaloneWine(): string | null {
  return STANDALONE_WINES.find((wine) => fs.existsSync(wine)) ?? null;
}

export function hasWineRunner(prefix: WinePrefixRef): boolean {
  return (
    (prefix.launcher === 'crossover' ? findCrossOverWine() : findStandaloneWine()) !==
    null
  );
}

// A .bat or .cmd needs the prefix's own cmd, an .msi its msiexec; Wine starts an .exe by itself.
function programArgs(winPath: string, args: readonly string[]): string[] {
  if (/\.(bat|cmd)$/i.test(winPath)) {
    return ['cmd', '/c', winPath, ...args];
  }
  if (/\.msi$/i.test(winPath)) {
    return ['msiexec', '/i', winPath, ...args];
  }
  return [winPath, ...args];
}

/** How to run a program of this prefix; null when the prefix's Wine is not installed or the file is outside its drives. */
export function wineCommand(
  prefix: WinePrefixRef,
  hostFile: string,
  args: readonly string[],
  mode: 'wait' | 'detach'
): WineCommand | null {
  // CrossOver finds a file outside the bottle's drive_c only by its Windows path
  const winPath = hostToWinePath(prefix.prefix, hostFile);
  if (winPath === null) {
    return null;
  }
  if (prefix.launcher === 'crossover') {
    const wine = findCrossOverWine();
    return wine === null
      ? null
      : {
          file: wine,
          args: [
            '--bottle',
            prefix.prefix,
            '--no-gui',
            mode === 'wait' ? '--wait-children' : '--no-wait',
            ...programArgs(winPath, args),
          ],
          env: { ...process.env },
        };
  }
  const wine = findStandaloneWine();
  return wine === null
    ? null
    : {
        file: wine,
        args:
          mode === 'wait'
            ? programArgs(winPath, args)
            : ['start', '/unix', hostFile, ...args],
        env: { ...process.env, WINEPREFIX: prefix.prefix },
      };
}

/** Runs a Windows program in its prefix and resolves with its exit code once it and its children are done. */
export async function runInWine(
  prefix: WinePrefixRef,
  hostFile: string,
  args: readonly string[]
): Promise<number | null> {
  const command = wineCommand(prefix, hostFile, args, 'wait');
  if (command === null) {
    throw new Error(`No Wine to run ${hostFile} in ${prefix.prefix}`);
  }
  console.log(`[Wine] Running ${command.file} ${command.args.join(' ')}`);
  const child = spawn(command.file, command.args, {
    cwd: path.dirname(hostFile),
    env: command.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (data: Buffer) => {
    console.log(`[Wine stdout] ${data.toString().trim()}`);
  });
  child.stderr?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line && !/fixme:/.test(line)) {
      console.warn(`[Wine stderr] ${line}`);
    }
  });
  const [code] = (await once(child, 'close')) as [number | null];
  console.log(`[Wine] Exited with code ${code}`);
  return code;
}

/** Starts a Windows program in its prefix without waiting for it. */
export function startInWine(
  prefix: WinePrefixRef,
  hostFile: string,
  args: readonly string[]
): boolean {
  const command = wineCommand(prefix, hostFile, args, 'detach');
  if (command === null) {
    return false;
  }
  console.log(`[Wine] Starting ${command.file} ${command.args.join(' ')}`);
  const child = spawn(command.file, command.args, {
    cwd: path.dirname(hostFile),
    env: command.env,
    stdio: 'ignore',
    detached: true,
  });
  child.on('error', (error) => {
    console.error('[Wine] Failed to start:', error);
  });
  child.unref();
  return true;
}
