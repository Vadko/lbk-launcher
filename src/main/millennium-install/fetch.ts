import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { F } from '@mobily/ts-belt';
import got from 'got';
import { sha256File } from '@/main/installer/hash';
import type { MillenniumAsset } from './release';

export class MillenniumFetchError extends Error {
  constructor(
    readonly kind: 'download-failed' | 'checksum-mismatch' | 'cancelled',
    message: string
  ) {
    super(message);
  }
}

const RETRIES = 2;
const PROGRESS_THROTTLE_MS = 250;

async function isAlreadyVerified(dest: string, asset: MillenniumAsset): Promise<boolean> {
  try {
    if (fs.statSync(dest).size !== asset.size) {
      return false;
    }
    return (await sha256File(dest)) === asset.sha256;
  } catch {
    return false;
  }
}

async function downloadOnce(
  asset: MillenniumAsset,
  part: string,
  signal: AbortSignal | undefined,
  onProgress: ((fraction: number) => void) | undefined
): Promise<string> {
  const hash = createHash('sha256');
  let received = 0;
  const report = onProgress && F.throttle(onProgress, PROGRESS_THROTTLE_MS);
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > asset.size) {
        callback(
          new MillenniumFetchError('checksum-mismatch', 'archive larger than pinned')
        );
        return;
      }
      hash.update(chunk);
      report?.(received / asset.size);
      callback(null, chunk);
    },
  });
  await pipeline(
    got.stream(asset.url, {
      followRedirect: true,
      signal,
      timeout: { lookup: 10000, connect: 10000, secureConnect: 10000, response: 30000 },
    }),
    meter,
    fs.createWriteStream(part)
  );
  if (received !== asset.size) {
    throw new MillenniumFetchError(
      'checksum-mismatch',
      `size ${received} != pinned ${asset.size}`
    );
  }
  return hash.digest('hex');
}

// Streams into `<dest>.part`, hashing on the way, and renames only after size and sha256 match the pin.
export async function downloadVerified(
  asset: MillenniumAsset,
  dest: string,
  opts: { signal?: AbortSignal; onProgress?: (fraction: number) => void } = {}
): Promise<void> {
  if (await isAlreadyVerified(dest, asset)) {
    opts.onProgress?.(1);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.rmSync(dest, { force: true });
  const part = `${dest}.part`;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (opts.signal?.aborted) {
      fs.rmSync(part, { force: true });
      throw new MillenniumFetchError('cancelled', 'cancelled');
    }
    try {
      const digest = await downloadOnce(asset, part, opts.signal, opts.onProgress);
      if (digest !== asset.sha256) {
        throw new MillenniumFetchError('checksum-mismatch', `sha256 ${digest}`);
      }
      fs.renameSync(part, dest);
      opts.onProgress?.(1);
      return;
    } catch (error) {
      fs.rmSync(part, { force: true });
      if (opts.signal?.aborted) {
        throw new MillenniumFetchError('cancelled', 'cancelled');
      }
      if (error instanceof MillenniumFetchError) {
        throw error;
      }
      lastError = error;
    }
  }
  throw new MillenniumFetchError(
    'download-failed',
    lastError instanceof Error ? lastError.message : String(lastError)
  );
}
