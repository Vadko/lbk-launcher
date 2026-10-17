import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  environHasRuntimePath,
  isI386Elf,
  isMillenniumLinkTarget,
  isTakenOver,
  type LinkEntry,
  parseLdconfig,
  planLinuxLinks,
  removeLinuxLinks,
  renderEnvironmentFile,
} from './linux';

const DEBIAN = `
\tlibssl.so.3 (libc6,x86-64) => /lib/x86_64-linux-gnu/libssl.so.3
\tlibssl.so.3 (libc6) => /lib/i386-linux-gnu/libssl.so.3
\tlibcrypto.so.3 (libc6,x86-64) => /lib/x86_64-linux-gnu/libcrypto.so.3
\tlibcrypto.so.3 (libc6) => /lib/i386-linux-gnu/libcrypto.so.3
`;
const ARCH = `
\tlibssl.so.3 (libc6,x86-64) => /usr/lib/libssl.so.3
\tlibssl.so.3 (libc6) => /usr/lib32/libssl.so.3
\tlibcrypto.so.3 (libc6,x86-64) => /usr/lib/libcrypto.so.3
\tlibcrypto.so.3 (libc6) => /usr/lib32/libcrypto.so.3
`;
const FEDORA = `
\tlibssl.so.3 (libc6,x86-64) => /lib64/libssl.so.3
\tlibssl.so.3 (libc6) => /lib/libssl.so.3
\tlibcrypto.so.3 (libc6,x86-64) => /lib64/libcrypto.so.3
\tlibcrypto.so.3 (libc6) => /lib/libcrypto.so.3
`;
const ONLY_64 = `
\tlibssl.so.3 (libc6,x86-64) => /lib/x86_64-linux-gnu/libssl.so.3
\tlibcrypto.so.3 (libc6,x86-64) => /lib/x86_64-linux-gnu/libcrypto.so.3
\tlibcrypto.so.3 (libc6) => /lib/i386-linux-gnu/libcrypto.so.3
`;

describe('parseLdconfig', () => {
  it('finds the 32-bit OpenSSL 3 pair on Debian, Arch and Fedora', () => {
    expect(parseLdconfig(DEBIAN)).toBe(true);
    expect(parseLdconfig(ARCH)).toBe(true);
    expect(parseLdconfig(FEDORA)).toBe(true);
  });

  it('rejects a system with only the 64-bit libssl', () => {
    expect(parseLdconfig(ONLY_64)).toBe(false);
    expect(parseLdconfig('')).toBe(false);
  });
});

describe('isI386Elf', () => {
  const header = (cls: number, machine: number) => {
    const b = Buffer.alloc(20);
    b.writeUInt32BE(0x7f454c46, 0);
    b[4] = cls;
    b.writeUInt16LE(machine, 18);
    return b;
  };

  it('accepts ELFCLASS32 EM_386 only', () => {
    expect(isI386Elf(header(1, 3))).toBe(true);
    expect(isI386Elf(header(2, 62))).toBe(false);
    expect(isI386Elf(Buffer.from('not an elf at all....'))).toBe(false);
  });
});

describe('planLinuxLinks', () => {
  const steamHome = '/home/u/.steam/steam';
  const lib = '/home/u/.local/lib/lbk-millennium/current';

  it('backs up regular files, replaces Millennium links and links missing ones', () => {
    const entries: Record<string, LinkEntry> = {
      'ubuntu12_32/libXtst.so.6': { kind: 'file' },
      'ubuntu12_64/libXtst.so.6': {
        kind: 'symlink',
        target: '/usr/lib/millennium/libmillennium_bootstrap_hhx64.so',
      },
    };
    const plan = planLinuxLinks(
      steamHome,
      lib,
      (rel) => entries[rel] ?? { kind: 'missing' }
    );
    expect(plan).toEqual({
      ok: true,
      steps: [
        {
          link: `${steamHome}/ubuntu12_32/libXtst.so.6`,
          target: `${lib}/libmillennium_bootstrap_x86.so`,
          backup: `${steamHome}/ubuntu12_32/libXtst.so.6.lbk-backup`,
        },
        {
          link: `${steamHome}/ubuntu12_64/libXtst.so.6`,
          target: `${lib}/libmillennium_bootstrap_hhx64.so`,
          backup: null,
        },
        {
          link: `${steamHome}/ubuntu12_64/libmillennium_hhx64.so`,
          target: `${lib}/libmillennium_hhx64.so`,
          backup: null,
        },
      ],
    });
  });

  it('refuses a foreign symlink', () => {
    const plan = planLinuxLinks(steamHome, lib, (rel) =>
      rel === 'ubuntu12_64/libXtst.so.6'
        ? { kind: 'symlink', target: '/opt/othermod/libXtst.so.6' }
        : { kind: 'missing' }
    );
    expect(plan).toEqual({
      ok: false,
      conflict: `${steamHome}/ubuntu12_64/libXtst.so.6`,
    });
  });
});

describe('environment helpers', () => {
  it('renders one MILLENNIUM_RUNTIME_PATH line', () => {
    expect(renderEnvironmentFile('/home/u/.local/lib/lbk-millennium/current/x.so')).toBe(
      'MILLENNIUM_RUNTIME_PATH=/home/u/.local/lib/lbk-millennium/current/x.so\n'
    );
  });

  it('reads the variable from a NUL-separated /proc environ', () => {
    const environ = Buffer.from(
      'HOME=/home/u\0MILLENNIUM_RUNTIME_PATH=/home/u/.local/lib/lbk-millennium/current/libmillennium_x86.so\0'
    );
    expect(environHasRuntimePath(environ)).toBe(true);
    expect(environHasRuntimePath('HOME=/home/u\0MILLENNIUM_RUNTIME_PATH=\0')).toBe(false);
    expect(environHasRuntimePath('XMILLENNIUM_RUNTIME_PATH=/x\0')).toBe(false);
  });
});

describe('isTakenOver', () => {
  const root = '/home/u/.local/lib/lbk-millennium';

  it('is true only when a Millennium link resolves outside our runtime', () => {
    expect(
      isTakenOver('/usr/lib/millennium/libmillennium_bootstrap_x86.so', [root])
    ).toBe(true);
    expect(isTakenOver(`${root}/3.5.0/libmillennium_bootstrap_x86.so`, [root])).toBe(
      false
    );
    expect(isTakenOver('/home/u/.steam/steam/ubuntu12_32/libXtst.so.6', [root])).toBe(
      false
    );
    expect(isTakenOver(null, [root])).toBe(false);
  });

  it('accepts our runtime reached through a symlinked home', () => {
    const real = '/var/home/u/.local/lib/lbk-millennium';
    const target = `${real}/3.5.0/libmillennium_bootstrap_x86.so`;
    expect(isTakenOver(target, [root])).toBe(true);
    expect(isTakenOver(target, [root, real])).toBe(false);
  });

  it('matches the uninstall link predicate', () => {
    expect(isMillenniumLinkTarget(`${root}/current/libmillennium_hhx64.so`)).toBe(true);
    expect(isMillenniumLinkTarget('/usr/lib/libXtst.so.6')).toBe(false);
  });
});

describe.skipIf(process.platform === 'win32')('removeLinuxLinks', () => {
  let home: string | null = null;

  afterEach(() => {
    if (home) {
      fs.rmSync(home, { recursive: true, force: true });
      home = null;
    }
  });

  it("removes only links into LBK's runtime and restores their backups", () => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-links-'));
    const steamHome = path.posix.join(home, '.steam/steam');
    const runtimeRoot = path.posix.join(home, '.local/lib/lbk-millennium');
    const ours = path.posix.join(steamHome, 'ubuntu12_32/libXtst.so.6');
    const foreign = path.posix.join(steamHome, 'ubuntu12_64/libXtst.so.6');
    fs.mkdirSync(path.posix.dirname(ours), { recursive: true });
    fs.mkdirSync(path.posix.dirname(foreign), { recursive: true });
    fs.symlinkSync(`${runtimeRoot}/current/libmillennium_bootstrap_x86.so`, ours);
    fs.symlinkSync('/usr/lib/millennium/libmillennium_bootstrap_hhx64.so', foreign);
    fs.writeFileSync(`${ours}.lbk-backup`, 'valve-32');
    fs.writeFileSync(`${foreign}.lbk-backup`, 'valve-64');

    removeLinuxLinks(steamHome, runtimeRoot, [
      { link: ours, backup: `${ours}.lbk-backup` },
      { link: foreign, backup: `${foreign}.lbk-backup` },
    ]);

    expect(fs.readFileSync(ours, 'utf8')).toBe('valve-32');
    expect(fs.readlinkSync(foreign)).toBe(
      '/usr/lib/millennium/libmillennium_bootstrap_hhx64.so'
    );
    expect(fs.readFileSync(`${foreign}.lbk-backup`, 'utf8')).toBe('valve-64');
  });
});
