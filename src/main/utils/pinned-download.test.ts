import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { sha256 } from './hash';
import { downloadPinned, PinnedDownloadError } from './pinned-download';

const BODY = Buffer.from('pinned payload '.repeat(64));
const routes: Record<string, Buffer> = {
  '/ok': BODY,
  '/longer': Buffer.concat([BODY, Buffer.from('extra')]),
};
let hits = 0;
let base = '';
let dir = '';

const server = http.createServer((req, res) => {
  hits += 1;
  const body = routes[req.url ?? ''];
  if (!body) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-length': body.length }).end(body);
});

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  hits = 0;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-pinned-'));
  return () => fs.rmSync(dir, { recursive: true, force: true });
});

const pin = (
  route: string,
  overrides: Partial<{ sha256: string; size: number }> = {}
) => ({
  url: `${base}${route}`,
  sha256: sha256(BODY),
  size: BODY.length,
  ...overrides,
});

describe('downloadPinned', () => {
  it('writes the file only after it matches the pin and ends at 100%', async () => {
    const dest = path.join(dir, 'nested', 'file.bin');
    const onProgress = vi.fn();
    await downloadPinned(pin('/ok'), dest, { onProgress });
    expect(fs.readFileSync(dest)).toEqual(BODY);
    expect(onProgress).toHaveBeenLastCalledWith(1);

    await downloadPinned(pin('/ok'), dest);
    expect(hits).toBe(1);
  });

  it.each([
    ['a different sha256', '/ok', { sha256: 'f'.repeat(64) }, 'checksum-mismatch'],
    ['a body larger than pinned', '/longer', {}, 'checksum-mismatch'],
    ['a missing file', '/missing', {}, 'download-failed'],
  ])('refuses %s and leaves no file', async (_name, route, overrides, kind) => {
    const dest = path.join(dir, 'file.bin');
    const failure = await downloadPinned(pin(route, overrides), dest).catch(
      (error: unknown) => error
    );
    expect(failure).toBeInstanceOf(PinnedDownloadError);
    expect(failure).toMatchObject({ kind });
    expect(fs.existsSync(dest)).toBe(false);
  });

  it('reports a cancelled download', async () => {
    await expect(
      downloadPinned(pin('/ok'), path.join(dir, 'file.bin'), {
        signal: AbortSignal.abort(),
      })
    ).rejects.toMatchObject({ kind: 'cancelled' });
  });
});
