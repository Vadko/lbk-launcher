import { describe, expect, it } from 'vitest';
import { isCmdSafePath } from './shell-safety';

describe('isCmdSafePath', () => {
  it('accepts ordinary game paths', () => {
    expect(isCmdSafePath('C:\\Games\\Stardew Valley\\install.bat')).toBe(true);
    expect(
      isCmdSafePath('C:\\Program Files (x86)\\Steam\\common\\Gra\\install.bat')
    ).toBe(true);
  });

  it('accepts names the project actually uses', () => {
    expect(isCmdSafePath('C:\\G\\Українізатор (бета)\\install.bat')).toBe(true);
    expect(isCmdSafePath('C:\\G\\100% тексту\\100% озвучки\\install.bat')).toBe(true);
    expect(isCmdSafePath("C:\\G\\Dev's build\\install.bat")).toBe(true);
  });

  it('rejects a quote, which would end the quoted run', () => {
    expect(isCmdSafePath('C:\\G\\x.bat" & calc & "')).toBe(false);
  });

  it('rejects environment variable expansion', () => {
    expect(isCmdSafePath('C:\\G\\%TEMP%\\x.bat')).toBe(false);
    expect(isCmdSafePath('C:\\G\\%APPDATA%\\x.bat')).toBe(false);
  });

  it('rejects control characters', () => {
    expect(isCmdSafePath('C:\\G\\x.bat\ncalc')).toBe(false);
    expect(isCmdSafePath('C:\\G\\x.bat\r\ncalc')).toBe(false);
  });
});
