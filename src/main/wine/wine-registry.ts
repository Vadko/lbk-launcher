import * as path from 'node:path';
import { readTextOrNull } from '@/main/utils/fs-safe';

// A port of Wine's own reader (server/unicode.c parse_strW, server/registry.c load_keys): no npm package reads its .reg files, and registry-js reads only the live Windows registry

const C_ESCAPES: Partial<Record<string, string>> = {
  a: '\x07',
  b: '\b',
  e: '\x1b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
};

// The type tags of a value whose data is text; dword and hex values are not read
const STRING_TAGS = ['"', 'str:"', 'str(2):"', 'str(7):"'];

interface ParsedStr {
  text: string;
  next: number;
}

/** Text from `start` up to an unescaped `end`, as parse_strW reads it; null when no `end` closes it. */
function parseStr(src: string, start: number, end: string): ParsedStr | null {
  const units: number[] = [];
  let i = start;
  while (i < src.length && src[i] !== end) {
    if (src[i] === '\\' && i + 1 < src.length) {
      const next = src[i + 1];
      const escape = C_ESCAPES[next];
      if (escape !== undefined) {
        units.push(escape.charCodeAt(0));
        i += 2;
        continue;
      }
      // Up to four hex digits of one UTF-16 unit, which is how Wine writes every non-ASCII character
      if (next === 'x') {
        const hex = /^[0-9a-fA-F]{0,4}/.exec(src.slice(i + 2))?.[0] ?? '';
        units.push(hex ? Number.parseInt(hex, 16) : next.charCodeAt(0));
        i += 2 + hex.length;
        continue;
      }
      const octal = /^[0-7]{1,3}/.exec(src.slice(i + 1))?.[0];
      if (octal) {
        units.push(Number.parseInt(octal, 8));
        i += 1 + octal.length;
        continue;
      }
      // Any other escaped character stands for itself, a backslash or a quote included
      i += 1;
    }
    units.push(src.charCodeAt(i));
    i += 1;
  }
  return i < src.length ? { text: String.fromCharCode(...units), next: i + 1 } : null;
}

type RegLine =
  | { kind: 'key'; name: string }
  | { kind: 'value'; name: string; text: string | null };

function parseValue(line: string): RegLine | null {
  const name = line.startsWith('@') ? { text: '', next: 1 } : parseStr(line, 1, '"');
  if (name === null) {
    return null;
  }
  const data = line.slice(name.next).trimStart();
  if (!data.startsWith('=')) {
    return null;
  }
  const rest = data.slice(1).trimStart();
  const tag = STRING_TAGS.find((candidate) => rest.startsWith(candidate));
  return {
    kind: 'value',
    name: name.text,
    text: tag === undefined ? null : (parseStr(rest, tag.length, '"')?.text ?? null),
  };
}

function parseLine(raw: string): RegLine | null {
  const line = raw.trimStart();
  if (line.startsWith('[')) {
    const key = parseStr(line, 1, ']');
    return key === null ? null : { kind: 'key', name: key.text };
  }
  return line.startsWith('"') || line.startsWith('@') ? parseValue(line) : null;
}

/** One string value of a key in a Wine registry file, key and name compared without case as Wine does. */
export function readRegString(content: string, key: string, name: string): string | null {
  const wantedKey = key.toLowerCase();
  const wantedName = name.toLowerCase();
  let inKey = false;
  for (const raw of content.split(/\r?\n/)) {
    const line = parseLine(raw);
    if (line?.kind === 'key') {
      inKey = line.name.toLowerCase() === wantedKey;
    } else if (
      inKey &&
      line?.kind === 'value' &&
      line.name.toLowerCase() === wantedName
    ) {
      return line.text;
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
