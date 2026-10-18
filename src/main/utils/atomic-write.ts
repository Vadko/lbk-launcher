import * as fs from 'node:fs';
import * as path from 'node:path';
import { sync as writeFileAtomicSync } from 'write-file-atomic';
import { isWindows } from './platform';

// `allowInPlace` falls back to a direct write when Windows refuses to rename over an open file.
export function writeFileAtomic(
  filePath: string,
  content: string | Buffer,
  opts: { mode?: number; allowInPlace?: boolean } = {}
): void {
  const writeOpts = opts.mode === undefined ? {} : { mode: opts.mode };
  try {
    writeFileAtomicSync(filePath, content, writeOpts);
  } catch (error) {
    if (!opts.allowInPlace || !isWindows()) {
      throw error;
    }
    fs.writeFileSync(filePath, content, writeOpts);
  }
}

// Replaces whatever `linkPath` is with a symlink, never leaving it missing in between.
export function replaceSymlinkAtomic(target: string, linkPath: string): void {
  const tmp = `${linkPath}.lbk.tmp`;
  fs.rmSync(tmp, { force: true });
  fs.symlinkSync(target, tmp);
  try {
    fs.renameSync(tmp, linkPath);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}

export function copyFileAtomic(src: string, dest: string): void {
  const tmp = `${dest}.lbk.tmp`;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, tmp);
  try {
    fs.renameSync(tmp, dest);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}

export function dirSwapPath(dest: string): string {
  return `${dest}.lbk-new`;
}

// `fill` builds the new tree in `dirSwapPath(dest)`; a fixed name means a crash leaves one stale copy that the next run removes.
export function replaceDirAtomic(dest: string, fill: (tmp: string) => void): void {
  const tmp = dirSwapPath(dest);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fill(tmp);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(tmp, dest);
  } catch (error) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw error;
  }
}
