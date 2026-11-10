import * as path from 'node:path';
import { readTextOrNull } from '@/main/utils/fs-safe';

// Wine writes non-ASCII as \x followed by up to four hex digits of one UTF-16 code unit, so Cyrillic paths survive only through it.
export function decodeRegString(raw: string): string {
  const units: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (char !== '\\' || i === raw.length - 1) {
      units.push(raw.charCodeAt(i));
      continue;
    }
    const next = raw[i + 1];
    const hex =
      next === 'x' ? /^[0-9a-fA-F]{1,4}/.exec(raw.slice(i + 2))?.[0] : undefined;
    if (hex) {
      units.push(Number.parseInt(hex, 16));
      i += 1 + hex.length;
      continue;
    }
    units.push(raw.charCodeAt(i + 1));
    i += 1;
  }
  return String.fromCharCode(...units);
}

/** One string value of a key in a Wine registry file (keys written as `Software\\Valve\\Steam`, compared without case). */
export function readRegString(content: string, key: string, name: string): string | null {
  const header = `[${key.replace(/\\/g, '\\\\').toLowerCase()}]`;
  const valuePrefix = `"${name.toLowerCase()}"="`;
  let inKey = false;
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith('[')) {
      inKey = line.toLowerCase().startsWith(header);
      continue;
    }
    if (inKey && line.toLowerCase().startsWith(valuePrefix) && line.endsWith('"')) {
      return decodeRegString(line.slice(valuePrefix.length, -1));
    }
  }
  return null;
}

export function readUserRegString(
  prefix: string,
  key: string,
  name: string
): string | null {
  const content = readTextOrNull(path.join(prefix, 'user.reg'));
  return content === null ? null : readRegString(content, key, name);
}
