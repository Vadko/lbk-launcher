import { describe, expect, it } from 'vitest';
import { compareVersions } from './version';

describe('compareVersions', () => {
  it('compares numerically', () => {
    expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.1', '1.1.0')).toBe(0);
  });

  it('accepts a v prefix and orders prereleases before the release', () => {
    expect(compareVersions('v3.1.10', '3.1.9')).toBe(1);
    expect(compareVersions('1.1.0-beta.1', '1.1.0')).toBe(-1);
  });

  it('treats an unparseable version as the oldest', () => {
    expect(compareVersions('garbage', '0.0.1')).toBe(-1);
    expect(compareVersions('garbage', '')).toBe(0);
  });
});
