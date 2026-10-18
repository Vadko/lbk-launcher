import * as fs from 'node:fs';
import type { z } from 'zod';

// A missing, unreadable, malformed or off-schema file all read as null.
export function readJsonFile<T extends z.ZodType>(
  file: string,
  schema: T
): z.output<T> | null {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  const result = schema.safeParse(raw);
  return result.success ? result.data : null;
}
