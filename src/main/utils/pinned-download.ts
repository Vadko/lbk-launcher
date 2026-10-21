import * as fs from 'node:fs';
import * as path from 'node:path';
import { F } from '@mobily/ts-belt';
import got from 'got';
import { writeFileAtomic } from '@/main/utils/atomic-write';
import { sha256, sha256File } from '@/main/utils/hash';
import { errorMessage } from '@/shared/errors';

export interface PinnedFile {
  url: string;
  sha256: string;
  size: number;
}

export class PinnedDownloadError extends Error {
  constructor(
    readonly kind: 'download-failed' | 'checksum-mismatch' | 'cancelled',
    message: string
  ) {
    super(message);
  }
}

const PROGRESS_THROTTLE_MS = 250;
const TIMEOUT = { lookup: 10000, connect: 10000, secureConnect: 10000, response: 30000 };

async function isAlreadyVerified(dest: string, file: PinnedFile): Promise<boolean> {
  if (fs.statSync(dest, { throwIfNoEntry: false })?.size !== file.size) {
    return false;
  }
  return (await sha256File(dest).catch(() => null)) === file.sha256;
}

// Pinned files are a few MB, so the body stays in memory and `dest` appears only once size and sha256 match.
export async function downloadPinned(
  file: PinnedFile,
  dest: string,
  opts: { signal?: AbortSignal; onProgress?: (fraction: number) => void } = {}
): Promise<void> {
  if (await isAlreadyVerified(dest, file)) {
    opts.onProgress?.(1);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.rmSync(dest, { force: true });

  const oversize = new AbortController();
  const signal = opts.signal
    ? AbortSignal.any([opts.signal, oversize.signal])
    : oversize.signal;
  const report = opts.onProgress && F.throttle(opts.onProgress, PROGRESS_THROTTLE_MS);
  const bytes = await got(file.url, { signal, retry: { limit: 2 }, timeout: TIMEOUT })
    .on('downloadProgress', ({ transferred }) => {
      if (transferred > file.size) {
        oversize.abort();
      } else {
        report?.(transferred / file.size);
      }
    })
    .buffer()
    .catch((error: unknown) => {
      if (opts.signal?.aborted) {
        throw new PinnedDownloadError('cancelled', 'cancelled');
      }
      if (oversize.signal.aborted) {
        throw new PinnedDownloadError('checksum-mismatch', 'file larger than pinned');
      }
      throw new PinnedDownloadError('download-failed', errorMessage(error));
    });
  const body = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (body.byteLength !== file.size) {
    throw new PinnedDownloadError(
      'checksum-mismatch',
      `size ${body.byteLength} != pinned ${file.size}`
    );
  }
  const digest = sha256(body);
  if (digest !== file.sha256) {
    throw new PinnedDownloadError('checksum-mismatch', `sha256 ${digest}`);
  }
  writeFileAtomic(dest, body);
  opts.onProgress?.(1);
}
