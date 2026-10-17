import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  applyWindowsActivation,
  classifyWindowsLoader,
  isSameFile,
  planWindowsActivation,
  planWindowsRemoval,
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
  const hhx64 = { ino: 2n ** 60n + 7n, dev: 3n };

  it('removes the loader first and only version.dll files hardlinked to the hook', () => {
    const steps = planWindowsRemoval({
      hhx64,
      versionDlls: [
        { rel: 'bin/cef/cef.win64/version.dll', id: { ino: 2n ** 60n + 7n, dev: 3n } },
        { rel: 'bin/cef/cef.win7x64/version.dll', id: { ino: 2n ** 60n + 8n, dev: 3n } },
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

  it('keeps version.dll when the hook is gone or the dll is missing', () => {
    const steps = planWindowsRemoval({
      hhx64: null,
      versionDlls: [{ rel: 'bin/cef/cef.win64/version.dll', id: hhx64 }],
      purge: true,
      pluginDirRel: 'millennium/plugins/lbk-bridge',
    });
    expect(steps.filter((s) => s.rel.endsWith('version.dll'))).toHaveLength(0);
    expect(steps.at(-1)).toEqual({ kind: 'dir', rel: 'millennium' });
    expect(isSameFile(hhx64, null)).toBe(false);
    expect(isSameFile(hhx64, { ino: hhx64.ino, dev: 4n })).toBe(false);
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
