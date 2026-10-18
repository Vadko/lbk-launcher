import { createHash, hash } from 'node:crypto';
import * as fs from 'node:fs';
import { readFileOrNull } from '@/main/utils/fs-safe';

export function sha256(data: string | Buffer): string {
  return hash('sha256', data);
}

export async function sha256File(filePath: string): Promise<string> {
  const hasher = createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) {
    hasher.update(chunk);
  }
  return hasher.digest('hex');
}

export function sha256FileSync(filePath: string): string | null {
  const data = readFileOrNull(filePath);
  return data && sha256(data);
}
