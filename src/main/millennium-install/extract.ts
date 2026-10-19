import * as fs from 'node:fs';
import { extract } from 'tar';
import { extractArchive } from '@/main/installer/archive';

// `strict` makes node-tar fail on `..`, absolute paths and escaping links instead of sanitising them; 7-Zip drops such zip paths and creates no links.
export async function extractMillenniumArchive(
  archive: string,
  kind: 'zip' | 'tar.gz',
  dest: string
): Promise<void> {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  if (kind === 'zip') {
    await extractArchive(archive, dest);
  } else {
    await extract({ file: archive, cwd: dest, strict: true });
  }
}
