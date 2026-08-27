import { afterAll, describe, expect, it, vi } from 'vitest';
import { forCurrentOS, getPlatform } from '@/main/utils/platform';

// The module reads `process.platform` at call time, so swapping the property is
// enough — no module mock, which means these tests exercise the real
// `getPlatform` → `forCurrentOS` composition rather than a stand-in for it.
function setPlatform(value: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value, configurable: true });
}

const realPlatform = process.platform;
afterAll(() => setPlatform(realPlatform));

/** An OS we never ship for — `getPlatform()` reports it as 'unknown'. */
const UNSHIPPED: NodeJS.Platform = 'freebsd';

describe('getPlatform', () => {
  it.each([
    ['win32', 'windows'],
    ['darwin', 'macos'],
    ['linux', 'linux'],
  ] as const)('maps %s to %s', (nodePlatform, expected) => {
    setPlatform(nodePlatform);
    expect(getPlatform()).toBe(expected);
  });

  it('reports anything else as unknown', () => {
    setPlatform(UNSHIPPED);
    expect(getPlatform()).toBe('unknown');
  });
});

describe('forCurrentOS — exhaustive form', () => {
  const branches = { windows: 'w', macos: 'm', linux: 'l' };

  it.each([
    ['win32', 'w'],
    ['darwin', 'm'],
    ['linux', 'l'],
  ] as const)('picks the %s branch', (nodePlatform, expected) => {
    setPlatform(nodePlatform);
    expect(forCurrentOS(branches)).toBe(expected);
  });

  it('returns null on an OS we do not ship for', () => {
    setPlatform(UNSHIPPED);
    expect(forCurrentOS(branches)).toBeNull();
  });
});

describe('forCurrentOS — catch-all form', () => {
  const branches = { windows: 'w', macos: 'm', other: 'rest' };

  it('prefers a named branch over the catch-all', () => {
    setPlatform('darwin');
    expect(forCurrentOS(branches)).toBe('m');
  });

  it('falls back to `other` for a platform left unnamed', () => {
    setPlatform('linux');
    expect(forCurrentOS(branches)).toBe('rest');
  });

  it('falls back to `other` on an OS we do not ship for', () => {
    setPlatform(UNSHIPPED);
    expect(forCurrentOS(branches)).toBe('rest');
  });
});

// The implementation checks `platform in branches`, not truthiness. A `??` or a
// falsy check would leak the catch-all into branches that deliberately hold a
// null — exactly the shape `pickOptionsForCurrentOS` passes, where "this OS has
// no launch options" is a real answer and must not become another OS's value.
describe('forCurrentOS — branches holding null or undefined', () => {
  it('lets an explicit null win over the catch-all', () => {
    setPlatform('win32');
    expect(
      forCurrentOS<string | null>({ windows: null, macos: 'm', other: 'rest' })
    ).toBeNull();
  });

  it('lets an explicit undefined win over the catch-all', () => {
    setPlatform('win32');
    expect(
      forCurrentOS<string | undefined>({
        windows: undefined,
        macos: 'm',
        other: 'rest',
      })
    ).toBeUndefined();
  });

  it('returns null for an all-null exhaustive record', () => {
    setPlatform('linux');
    expect(forCurrentOS({ windows: null, macos: null, linux: null })).toBeNull();
  });

  it('still reaches the catch-all when the current OS is genuinely absent', () => {
    setPlatform('linux');
    expect(forCurrentOS<string | null>({ windows: null, other: 'rest' })).toBe('rest');
  });
});

// Branches that spawn processes or hit the filesystem are passed as functions
// and called by the caller, so a losing branch must never run.
describe('forCurrentOS — function branches', () => {
  it('hands back only the winner, leaving the others uncalled', () => {
    const windows = vi.fn(() => 'w');
    const macos = vi.fn(() => 'm');
    const linux = vi.fn(() => 'l');

    setPlatform('darwin');
    const pick = forCurrentOS({ windows, macos, linux });

    expect(pick?.()).toBe('m');
    expect(macos).toHaveBeenCalledOnce();
    expect(windows).not.toHaveBeenCalled();
    expect(linux).not.toHaveBeenCalled();
  });

  it('calls nothing at all on an OS we do not ship for', () => {
    const windows = vi.fn();
    const macos = vi.fn();
    const linux = vi.fn();

    setPlatform(UNSHIPPED);
    expect(forCurrentOS({ windows, macos, linux })).toBeNull();

    expect(windows).not.toHaveBeenCalled();
    expect(macos).not.toHaveBeenCalled();
    expect(linux).not.toHaveBeenCalled();
  });
});
