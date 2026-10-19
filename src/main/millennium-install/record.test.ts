import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type MillenniumInstallRecord,
  managedByFor,
  parseInstallRecord,
  readInstallRecord,
  recordPathIn,
  writeInstallRecord,
} from './record';

vi.mock('@/main/game-detector/steam', () => ({ getSteamPath: () => null }));

const record: MillenniumInstallRecord = {
  format: 1,
  os: 'windows',
  mode: 'windows',
  tag: 'v3.5.0',
  version: '3.5.0',
  activatedAt: '2026-10-15T00:00:00.000Z',
  steamPath: 'C:\\Program Files (x86)\\Steam',
  xtstBackups: [],
};

describe('parseInstallRecord', () => {
  it('accepts a well-formed record and drops keys it does not know', () => {
    expect(parseInstallRecord(record)).toEqual(record);
    expect(parseInstallRecord({ ...record, purgeDir: '/' })).toStrictEqual(record);
  });

  it('rejects a wrong format, a mode that does not fit the OS or bad fields', () => {
    expect(parseInstallRecord({ ...record, format: 2 })).toBeNull();
    expect(parseInstallRecord({ ...record, mode: 'linux-user' })).toBeNull();
    expect(parseInstallRecord({ ...record, tag: '' })).toBeNull();
    expect(parseInstallRecord({ ...record, xtstBackups: [{ link: 1 }] })).toBeNull();
    expect(parseInstallRecord({ ...record, appBundle: 5 })).toBeNull();
    expect(parseInstallRecord(null)).toBeNull();
  });

  it('rejects paths a later activation or removal would delete outside our layout', () => {
    const mac = { ...record, os: 'macos', mode: 'macos-wrapper' };
    expect(
      parseInstallRecord({
        ...mac,
        appBundle: '/Users/u/Applications/Steam Millennium.app',
      })
    ).not.toBeNull();
    expect(parseInstallRecord({ ...mac, appBundle: '/Users/u' })).toBeNull();
    expect(
      parseInstallRecord({ ...mac, appBundle: '/Users/u/Documents/Steam Millennium.app' })
    ).toBeNull();
    expect(
      parseInstallRecord({
        ...mac,
        appBundle: '/Users/u/Applications/../Steam Millennium.app',
      })
    ).toBeNull();

    const linux = { ...record, os: 'linux', mode: 'linux-user', steamPath: '/s' };
    const link = '/home/u/.steam/steam/ubuntu12_32/libXtst.so.6';
    expect(
      parseInstallRecord({
        ...linux,
        envFile: '/home/u/.config/environment.d/lbk-millennium.conf',
        xtstBackups: [{ link, backup: `${link}.lbk-backup` }],
      })
    ).not.toBeNull();
    expect(parseInstallRecord({ ...linux, envFile: '/home/u/.bashrc' })).toBeNull();
    expect(
      parseInstallRecord({ ...linux, xtstBackups: [{ link, backup: '/home/u/.bashrc' }] })
    ).toBeNull();
    expect(
      parseInstallRecord({
        ...linux,
        xtstBackups: [{ link: '/home/u/.bashrc', backup: '/home/u/.bashrc.lbk-backup' }],
      })
    ).toBeNull();
  });
});

describe('managedByFor', () => {
  it('is lbk only for this OS and this Steam path', () => {
    expect(managedByFor(record, 'windows', 'c:\\program files (x86)\\steam\\')).toBe(
      'lbk'
    );
    expect(managedByFor(record, 'windows', 'D:\\Steam')).toBe('external');
    expect(managedByFor(record, 'linux', 'C:\\Program Files (x86)\\Steam')).toBe(
      'external'
    );
    expect(managedByFor(null, 'windows', record.steamPath)).toBe('external');
    expect(managedByFor(record, 'windows', null)).toBe('external');
  });

  it('compares Linux paths case-sensitively', () => {
    const linux: MillenniumInstallRecord = {
      ...record,
      os: 'linux',
      mode: 'linux-user',
      steamPath: '/home/u/.local/share/Steam',
    };
    expect(managedByFor(linux, 'linux', '/home/u/.local/share/Steam/')).toBe('lbk');
    expect(managedByFor(linux, 'linux', '/home/u/.local/share/steam')).toBe('external');
  });
});

describe('record file', () => {
  let dir = '';
  afterEach(() => {
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('round-trips through the atomic write', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-record-'));
    const file = recordPathIn(path.join(dir, 'millennium'));
    writeInstallRecord(file, record);
    expect(readInstallRecord(file)).toEqual(record);
    expect(fs.existsSync(`${file}.lbk.tmp`)).toBe(false);
    fs.writeFileSync(file, '{broken');
    expect(readInstallRecord(file)).toBeNull();
  });
});
