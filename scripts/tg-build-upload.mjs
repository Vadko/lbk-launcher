#!/usr/bin/env node
/**
 * Uploads all electron-builder release artifacts to Supabase Storage via TUS
 * (resumable upload), chunked at 6 MB to bypass Cloudflare's 100MB request limit.
 *
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TAG_NAME
 */

import { readFile, readdir, open, stat } from 'node:fs/promises';
import path from 'node:path';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TAG_NAME } = process.env;
const BUCKET = 'launcher-builds';
const CHUNK_SIZE = 6 * 1024 * 1024;
const ENDPOINT = `${SUPABASE_URL}/storage/v1/upload/resumable`;
const ARTIFACT_RE = /\.(exe|dmg|AppImage|rpm|zip|blockmap|yml)$/i;

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

async function uploadOne(filePath) {
  const { size } = await stat(filePath);
  const filename = path.basename(filePath);
  const objectName = `${TAG_NAME}/${filename}`;
  const sizeMb = (size / 1024 / 1024).toFixed(1);
  console.log(`→ ${filename} (${sizeMb} MB)`);

  const createRes = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(size),
      'Upload-Metadata': [
        `bucketName ${b64(BUCKET)}`,
        `objectName ${b64(objectName)}`,
        `contentType ${b64('application/octet-stream')}`,
        `cacheControl ${b64('3600')}`,
      ].join(','),
      'x-upsert': 'true',
    },
  });
  if (createRes.status !== 201) {
    throw new Error(`create ${filename}: ${createRes.status} ${await createRes.text()}`);
  }
  const uploadUrl = createRes.headers.get('location');
  if (!uploadUrl) throw new Error(`create ${filename}: missing Location header`);

  const fd = await open(filePath, 'r');
  try {
    let offset = 0;
    while (offset < size) {
      const len = Math.min(CHUNK_SIZE, size - offset);
      const buffer = Buffer.alloc(len);
      await fd.read(buffer, 0, len, offset);

      const patchRes = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream',
        },
        body: buffer,
      });
      if (patchRes.status !== 204) {
        throw new Error(
          `chunk ${filename}@${offset}: ${patchRes.status} ${await patchRes.text()}`
        );
      }
      offset += len;
      const pct = ((offset / size) * 100).toFixed(0).padStart(3);
      process.stdout.write(`\r  ${pct}%`);
    }
    process.stdout.write('\n');
  } finally {
    await fd.close();
  }
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TAG_NAME) {
    throw new Error('missing required env vars');
  }

  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const releaseDir = path.join('release', pkg.version);

  const entries = await readdir(releaseDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && ARTIFACT_RE.test(e.name))
    .map((e) => path.join(releaseDir, e.name));

  if (files.length === 0) {
    throw new Error(`no artifacts found in ${releaseDir}`);
  }

  console.log(`Uploading ${files.length} artifact(s) to ${BUCKET}/${TAG_NAME}/`);
  for (const file of files) {
    await uploadOne(file);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
