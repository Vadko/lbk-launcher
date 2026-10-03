import { afterAll, describe, expect, it } from 'vitest';
import { isExecutableInstaller } from '@/main/installer/executable';

// The helper reads `process.platform` through `isWindows()` at call time, so
// swapping the property is enough — same approach as utils/platform.test.ts.
function setPlatform(value: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value, configurable: true });
}

const realPlatform = process.platform;
afterAll(() => setPlatform(realPlatform));

describe('isExecutableInstaller', () => {
  it('accepts the known extensions', () => {
    setPlatform('linux');
    expect(isExecutableInstaller('setup.sh')).toBe(true);
    expect(isExecutableInstaller('patch.AppImage')).toBe(true);
  });

  it('accepts an extensionless Unix binary or shebang script', () => {
    setPlatform('linux');
    expect(isExecutableInstaller('install')).toBe(true);
    expect(isExecutableInstaller('tools/install')).toBe(true);
  });

  it('rejects an extensionless file on Windows', () => {
    setPlatform('win32');
    expect(isExecutableInstaller('install')).toBe(false);
  });

  it('still rejects a plain data file', () => {
    setPlatform('linux');
    expect(isExecutableInstaller('readme.txt')).toBe(false);
  });
});
