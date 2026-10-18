import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NtExecutable, NtExecutableResource, Resource } from 'resedit';
import { describe, expect, it, vi } from 'vitest';
import {
  applyWindowsActivation,
  applyWindowsRemoval,
  classifyWindowsLoader,
  planWindowsActivation,
  planWindowsRemoval,
  readMillenniumDllVersion,
  WINDOWS_EXPECTED_FILES,
} from './windows';

describe('planWindowsActivation', () => {
  it('copies the wsock32.dll loader last', () => {
    const order = planWindowsActivation([...WINDOWS_EXPECTED_FILES]);
    expect(order.at(-1)).toBe('wsock32.dll');
    expect(order).toHaveLength(WINDOWS_EXPECTED_FILES.length);
  });

  it('normalises backslashes from the staging listing', () => {
    expect(
      planWindowsActivation(['millennium\\lib\\millennium.dll', 'WSOCK32.dll'])
    ).toEqual(['millennium/lib/millennium.dll', 'wsock32.dll']);
  });
});

describe('classifyWindowsLoader', () => {
  it('treats a wsock32.dll without Millennium next to it as another mod', () => {
    expect(classifyWindowsLoader({ loader: true, millenniumLib: false })).toBe(
      'conflict'
    );
    expect(classifyWindowsLoader({ loader: true, millenniumLib: true })).toBe('ok');
    expect(classifyWindowsLoader({ loader: false, millenniumLib: false })).toBe('ok');
  });
});

describe('planWindowsRemoval', () => {
  it('removes the loader first and only version.dll files hardlinked to the hook', () => {
    const steps = planWindowsRemoval({
      versionDlls: [
        { rel: 'bin/cef/cef.win64/version.dll', linkedToHook: true },
        { rel: 'bin/cef/cef.win7x64/version.dll', linkedToHook: false },
      ],
      purge: false,
      pluginDirRel: 'millennium/plugins/lbk-bridge',
    });
    expect(steps[0]).toEqual({ kind: 'file', rel: 'wsock32.dll' });
    expect(steps).toContainEqual({ kind: 'file', rel: 'bin/cef/cef.win64/version.dll' });
    expect(steps).not.toContainEqual({
      kind: 'file',
      rel: 'bin/cef/cef.win7x64/version.dll',
    });
    expect(steps.at(-1)).toEqual({ kind: 'dir', rel: 'millennium/plugins/lbk-bridge' });
    expect(steps).not.toContainEqual({ kind: 'dir', rel: 'millennium' });
  });

  it('purges the whole millennium folder last', () => {
    const steps = planWindowsRemoval({
      versionDlls: [],
      purge: true,
      pluginDirRel: 'millennium/plugins/lbk-bridge',
    });
    expect(steps.at(-1)).toEqual({ kind: 'dir', rel: 'millennium' });
  });
});

describe('applyWindowsRemoval', () => {
  it('deletes only the version.dll that is a hardlink of the hook', () => {
    const steam = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-winrm-'));
    try {
      const hook = path.join(steam, 'millennium/lib/millennium.hhx64.dll');
      const linked = path.join(steam, 'bin/cef/cef.win64/version.dll');
      const own = path.join(steam, 'bin/cef/cef.win7x64/version.dll');
      for (const file of [hook, linked, own]) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
      }
      fs.writeFileSync(hook, 'hook');
      fs.linkSync(hook, linked);
      fs.copyFileSync(hook, own);

      applyWindowsRemoval(steam, false, 'millennium/plugins/lbk-bridge');

      expect(fs.existsSync(linked)).toBe(false);
      expect(fs.existsSync(own)).toBe(true);
      expect(fs.existsSync(hook)).toBe(false);
    } finally {
      fs.rmSync(steam, { recursive: true, force: true });
    }
  });
});

describe('applyWindowsActivation', () => {
  it('skips LBK markers and records the install right before the loader lands', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-win-'));
    try {
      const staging = path.join(root, 'staging');
      const steam = path.join(root, 'steam');
      fs.mkdirSync(path.join(staging, 'millennium/lib'), { recursive: true });
      fs.mkdirSync(steam);
      fs.writeFileSync(path.join(staging, 'wsock32.dll'), 'loader');
      fs.writeFileSync(path.join(staging, 'millennium/lib/millennium.dll'), 'lib');
      fs.writeFileSync(path.join(staging, '.lbk-ready'), 'marker');

      const beforeLoader = vi.fn(() => {
        expect(fs.existsSync(path.join(steam, 'millennium/lib/millennium.dll'))).toBe(
          true
        );
        expect(fs.existsSync(path.join(steam, 'wsock32.dll'))).toBe(false);
      });
      applyWindowsActivation(staging, steam, {
        skip: new Set(['.lbk-ready']),
        beforeLoader,
      });

      expect(beforeLoader).toHaveBeenCalledTimes(1);
      expect(fs.readFileSync(path.join(steam, 'wsock32.dll'), 'utf8')).toBe('loader');
      expect(fs.existsSync(path.join(steam, '.lbk-ready'))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

function writeDll(file: string, fileVersion: string): void {
  const exe = NtExecutable.createEmpty(false, true);
  const res = NtExecutableResource.from(exe);
  const info = Resource.VersionInfo.createEmpty();
  info.setStringValues({ lang: 1033, codepage: 1200 }, { FileVersion: fileVersion });
  info.outputToResourceEntries(res.entries);
  res.outputResource(exe);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(exe.generate()));
}

describe('readMillenniumDllVersion', () => {
  const dll = (root: string) => path.join(root, 'millennium/lib/millennium.dll');

  it('reads the version Millennium updated itself to', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-mdll-'));
    writeDll(dll(root), 'v3.5.0');
    expect(readMillenniumDllVersion(root)).toBe('3.5.0');
    writeDll(dll(root), 'v3.6.1-extra');
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(dll(root), later, later);
    expect(readMillenniumDllVersion(root)).toBe('3.6.1');
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('returns null for a missing or unreadable DLL', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-mdll-'));
    expect(readMillenniumDllVersion(root)).toBeNull();
    fs.mkdirSync(path.dirname(dll(root)), { recursive: true });
    fs.writeFileSync(dll(root), 'not a PE file');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(readMillenniumDllVersion(root)).toBeNull();
    fs.rmSync(root, { recursive: true, force: true });
  });
});
