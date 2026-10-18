import { type ChildProcess, execFile, spawn } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 16 * 1024 * 1024;

export function isFlatpak(): boolean {
  return Boolean(process.env.FLATPAK_ID);
}

export function system32(...segments: string[]): string {
  return path.win32.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    ...segments
  );
}

export function execFileOnHost(
  command: string,
  args: string[],
  timeout = 10000
): Promise<{ stdout: string; stderr: string }> {
  if (isFlatpak()) {
    return execFileAsync('flatpak-spawn', ['--host', command, ...args], {
      timeout,
      maxBuffer: MAX_BUFFER,
    });
  }
  return execFileAsync(command, args, { timeout, maxBuffer: MAX_BUFFER });
}

// Detached so the child outlives LBK; flatpak-spawn drops the sandbox environment, so `env` travels as --env.
export function spawnOnHost(
  command: string,
  args: string[] = [],
  env: Record<string, string> = {}
): ChildProcess {
  const child = isFlatpak()
    ? spawn(
        'flatpak-spawn',
        [
          '--host',
          ...Object.entries(env).map(([key, value]) => `--env=${key}=${value}`),
          command,
          ...args,
        ],
        { detached: true, stdio: 'ignore' }
      )
    : spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, ...env },
      });
  child.on('error', (error) => {
    console.error(`[HostExec] Error spawning ${command}:`, error);
  });
  child.unref();
  return child;
}
