import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { create } from 'tar';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/main/installer/archive', () => ({
  extractArchive: vi.fn(),
  getCleanEnv: () => ({}),
}));

const { extractMillenniumArchive, findEscapingLink, isSafeArchiveEntry } = await import(
  './extract'
);

describe('isSafeArchiveEntry', () => {
  it('accepts relative entries, including the ./ prefix tar prints', () => {
    expect(isSafeArchiveEntry('./usr/lib/millennium/libmillennium_x86.so')).toBe(true);
    expect(isSafeArchiveEntry('millennium-3.5.0/runtime/')).toBe(true);
  });

  it('rejects absolute paths, drive letters and parent segments', () => {
    expect(isSafeArchiveEntry('/etc/passwd')).toBe(false);
    expect(isSafeArchiveEntry('C:\\Windows\\x.dll')).toBe(false);
    expect(isSafeArchiveEntry('a/../../b')).toBe(false);
    expect(isSafeArchiveEntry('..\\b')).toBe(false);
    expect(isSafeArchiveEntry('')).toBe(false);
  });
});

describe.skipIf(process.platform === 'win32')('findEscapingLink', () => {
  let root: string | null = null;

  afterEach(() => {
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
      root = null;
    }
  });

  function tree(): string {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-extract-'));
    fs.mkdirSync(path.join(root, 'runtime/lib'), { recursive: true });
    fs.writeFileSync(path.join(root, 'runtime/lib/a.so'), '');
    return root;
  }

  it('accepts links that stay inside the extracted tree', () => {
    const dir = tree();
    fs.symlinkSync('lib/a.so', path.join(dir, 'runtime/a.so'));
    fs.symlinkSync('../runtime', path.join(dir, 'runtime/lib/up'));
    expect(findEscapingLink(dir)).toBeNull();
  });

  it('finds absolute links and links that climb out', () => {
    const dir = tree();
    fs.symlinkSync('/etc', path.join(dir, 'runtime/lib/etc'));
    expect(findEscapingLink(dir)).toBe(path.join(dir, 'runtime/lib/etc'));
    fs.rmSync(path.join(dir, 'runtime/lib/etc'));
    fs.symlinkSync('../../../home', path.join(dir, 'runtime/lib/home'));
    expect(findEscapingLink(dir)).toBe(path.join(dir, 'runtime/lib/home'));
  });
});

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
  ): Promise<{ tgz: string; dest: string }> {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-untar-'));
    const src = path.join(root, 'src');
    fs.mkdirSync(path.join(src, 'lib'), { recursive: true });
    const tgz = path.join(root, 'a.tar.gz');
    await create({ gzip: true, file: tgz, cwd: src, preservePaths: true }, build(src));
    return { tgz, dest: path.join(root, 'out', 'dest') };
  }

  it('keeps modes and links that stay inside', async () => {
    const { tgz, dest } = await pack((src) => {
      fs.writeFileSync(path.join(src, 'lib/luavm'), '#!/bin/sh\n', { mode: 0o755 });
      fs.symlinkSync('luavm', path.join(src, 'lib/current'));
      return ['lib'];
    });
    await extractMillenniumArchive(tgz, 'tar.gz', dest);
    expect(fs.statSync(path.join(dest, 'lib/luavm')).mode & 0o777).toBe(0o755);
    expect(fs.readlinkSync(path.join(dest, 'lib/current'))).toBe('luavm');
  });

  it.each([
    [
      'a parent-relative entry',
      (src: string) => {
        fs.writeFileSync(path.join(src, '..', 'evil'), 'x');
        return ['../evil'];
      },
      '../evil',
    ],
    [
      'an absolute symlink',
      (src: string) => {
        fs.symlinkSync('/etc', path.join(src, 'lib/etc'));
        return ['lib/etc'];
      },
      'lib/etc',
    ],
    [
      'a symlink that climbs out',
      (src: string) => {
        fs.symlinkSync('../../home', path.join(src, 'lib/home'));
        return ['lib/home'];
      },
      'lib/home',
    ],
  ])('refuses %s and writes nothing outside dest', async (_name, build, entry) => {
    const { tgz, dest } = await pack(build);
    await expect(extractMillenniumArchive(tgz, 'tar.gz', dest)).rejects.toThrow(
      `unsafe archive entry: ${entry}`
    );
    expect(fs.readdirSync(path.join(root as string, 'out'))).toEqual(['dest']);
  });
});
