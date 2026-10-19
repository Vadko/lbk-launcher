import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { add } from 'node-7z';
import { afterEach, describe, expect, it, vi } from 'vitest';

const REPO = path.resolve(__dirname, '../../..');

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => REPO },
}));

const { createZip } = await import('@/main/installer/archive');

function bundled7z(): string | null {
  const arch = process.arch === 'x64' ? 'x64' : process.arch;
  const candidates: Partial<Record<NodeJS.Platform, string>> = {
    darwin: path.join(REPO, 'node_modules/7zip-bin-full/mac', process.arch, '7zz'),
    linux: path.join(REPO, 'node_modules/7zip-bin-full/linux', arch, '7zz'),
    win32: path.join(REPO, 'node_modules/7zip-bin-full/win', arch, '7z.exe'),
  };
  const bin = candidates[process.platform];
  return bin && fs.existsSync(bin) ? bin : null;
}

describe('createZip', () => {
  let root: string | null = null;
  afterEach(() => {
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  // Decky unzips into plugins/ and then looks for <dir>/plugin.json one level down.
  it.skipIf(!bundled7z())(
    'keeps the source folder as the single top-level entry',
    async () => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-zip-'));
      const src = path.join(root, 'stage', 'lbk-bridge');
      fs.mkdirSync(path.join(src, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(src, 'plugin.json'), '{}');
      fs.writeFileSync(path.join(src, 'dist', 'index.js'), 'export default () => ({});');
      const out = path.join(root, 'partial.zip');

      await createZip(src, out);

      const listing = execFileSync(bundled7z() as string, ['l', '-slt', '-ba', out], {
        encoding: 'utf8',
      });
      const entries = [...listing.matchAll(/^Path = (.+)$/gm)]
        .map((m) => m[1].replaceAll('\\', '/'))
        .sort();
      expect(entries).toEqual([
        'lbk-bridge',
        'lbk-bridge/dist',
        'lbk-bridge/dist/index.js',
        'lbk-bridge/plugin.json',
      ]);
    }
  );
});

// patches/node-7z@3.0.0.patch: without it node-7z drops $spawnOptions and LD_PRELOAD reaches 7z on the Deck.
describe('node-7z $spawnOptions', () => {
  let root: string | null = null;
  afterEach(() => {
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === 'win32')(
    'passes env and cwd to the 7z process',
    async () => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-7z-env-'));
      const probe = path.join(root, 'probe.txt');
      const bin = path.join(root, 'fake7z.sh');
      fs.writeFileSync(bin, `#!/bin/sh\necho "$LBK_PROBE $(pwd -P)" > "${probe}"\n`, {
        mode: 0o755,
      });

      await new Promise<void>((resolve, reject) => {
        const stream = add('out.zip', 'src', {
          $bin: bin,
          $spawnOptions: {
            cwd: root as string,
            env: { ...process.env, LBK_PROBE: 'clean' },
          },
        });
        stream.on('end', () => resolve());
        stream.on('error', reject);
      });

      expect(fs.readFileSync(probe, 'utf8').trim()).toBe(
        `clean ${fs.realpathSync(root)}`
      );
    }
  );
});
