import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { create } from 'tar';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/main/installer/archive', () => ({
  extractArchive: vi.fn(),
  getCleanEnv: () => ({}),
}));

const { extractMillenniumArchive } = await import('./extract');

describe.skipIf(process.platform === 'win32')('extractMillenniumArchive tar.gz', () => {
  let root: string | null = null;

  afterEach(() => {
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
      root = null;
    }
  });

  async function pack(
    build: (src: string) => string[]
  ): Promise<{ tgz: string; dest: string; src: string }> {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-untar-'));
    const src = path.join(root, 'src');
    fs.mkdirSync(path.join(src, 'lib'), { recursive: true });
    const tgz = path.join(root, 'a.tar.gz');
    await create({ gzip: true, file: tgz, cwd: src, preservePaths: true }, build(src));
    return { tgz, dest: path.join(root, 'out', 'dest'), src };
  }

  it('keeps modes and links that stay inside', async () => {
    const { tgz, dest } = await pack((src) => {
      fs.writeFileSync(path.join(src, 'lib/luavm'), '#!/bin/sh\n', { mode: 0o755 });
      fs.symlinkSync('luavm', path.join(src, 'lib/current'));
      fs.symlinkSync('../lib', path.join(src, 'lib/up'));
      return ['lib'];
    });
    await extractMillenniumArchive(tgz, 'tar.gz', dest);
    expect(fs.statSync(path.join(dest, 'lib/luavm')).mode & 0o777).toBe(0o755);
    expect(fs.readlinkSync(path.join(dest, 'lib/current'))).toBe('luavm');
    expect(fs.readlinkSync(path.join(dest, 'lib/up'))).toBe('../lib');
  });

  it.each([
    [
      'a parent-relative entry',
      (src: string) => {
        fs.writeFileSync(path.join(src, '..', 'evil'), 'x');
        return ['../evil'];
      },
      "path contains '..'",
    ],
    [
      'an absolute symlink',
      (src: string) => {
        fs.symlinkSync('/etc', path.join(src, 'lib/etc'));
        return ['lib/etc'];
      },
      'absolute linkpath',
    ],
    [
      'a symlink that climbs out',
      (src: string) => {
        fs.symlinkSync('../../home', path.join(src, 'lib/home'));
        return ['lib/home'];
      },
      'linkpath escapes extraction directory',
    ],
  ])('refuses %s and writes nothing outside dest', async (_name, build, message) => {
    const { tgz, dest } = await pack(build);
    const before = [...fs.readdirSync(root as string), 'out'].sort();
    await expect(extractMillenniumArchive(tgz, 'tar.gz', dest)).rejects.toThrow(message);
    expect(fs.readdirSync(path.join(root as string, 'out'))).toEqual(['dest']);
    expect(fs.readdirSync(root as string).sort()).toEqual(before);
  });

  it('refuses an absolute entry path without writing to it', async () => {
    const { tgz, dest, src } = await pack((dir) => {
      fs.writeFileSync(path.join(dir, 'abs'), 'x');
      return [path.join(dir, 'abs')];
    });
    fs.rmSync(path.join(src, 'abs'));
    await expect(extractMillenniumArchive(tgz, 'tar.gz', dest)).rejects.toThrow(
      'absolute path'
    );
    expect(fs.existsSync(path.join(src, 'abs'))).toBe(false);
  });
});
