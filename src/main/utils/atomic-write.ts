import * as fs from 'node:fs';
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
