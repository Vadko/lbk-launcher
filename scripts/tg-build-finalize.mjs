#!/usr/bin/env node
/**
 * Finalizes a TG-triggered build:
 *   1. Lists files in launcher-builds/<TAG_NAME>/ on Supabase Storage
 *   2. Generates 30-day signed URLs for each
 *   3. Posts a single TG message with download links to the build thread
 *   4. Cleans up tag folders older than RETENTION_DAYS
 */

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  TELEGRAM_THREAD_ID,
  TAG_NAME,
  BUILD_RESULT,
} = process.env;

const BUCKET = 'launcher-builds';
const SIGNED_URL_TTL = 30 * 24 * 60 * 60; // 30 days
const RETENTION_DAYS = 30;

function authHeaders() {
  return {
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function listFolder(prefix) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      prefix,
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    }),
  });
  if (!res.ok) throw new Error(`list "${prefix}": ${res.status} ${await res.text()}`);
  return res.json();
}

async function signUrl(path) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${encodeURI(path)}`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL }),
    }
  );
  if (!res.ok) throw new Error(`sign "${path}": ${res.status} ${await res.text()}`);
  const { signedURL } = await res.json();
  return `${SUPABASE_URL}/storage/v1${signedURL}`;
}

async function deleteObjects(paths) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!res.ok) throw new Error(`delete: ${res.status} ${await res.text()}`);
  return res.json();
}

const TG_MAX = 4000; // TG hard limit is 4096; leave margin

function splitForTg(text) {
  if (text.length <= TG_MAX) return [text];
  const lines = text.split('\n');
  const chunks = [];
  let buf = '';
  for (const line of lines) {
    if (buf.length + line.length + 1 > TG_MAX) {
      if (buf) chunks.push(buf);
      buf = line;
    } else {
      buf = buf ? `${buf}\n${line}` : line;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

async function tg(text, { html = false } = {}) {
  for (const chunk of splitForTg(text)) {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: Number(TELEGRAM_CHAT_ID),
        message_thread_id: Number(TELEGRAM_THREAD_ID),
        text: chunk,
        disable_web_page_preview: true,
        ...(html ? { parse_mode: 'HTML' } : {}),
      }),
    });
    if (!res.ok) console.error('TG send failed:', res.status, await res.text());
  }
}

const escHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function classify(name) {
  if (/\.exe$/i.test(name)) return 'Windows';
  if (/\.dmg$/i.test(name)) return 'macOS';
  if (/\.AppImage$/i.test(name)) return 'Linux (AppImage)';
  if (/\.rpm$/i.test(name)) return 'Linux (RPM)';
  if (/\.zip$/i.test(name)) return 'Archive';
  return name;
}

async function announceBuild() {
  const files = await listFolder(`${TAG_NAME}/`);
  if (files.length === 0) {
    await tg(`⚠️ Білд завершився (${BUILD_RESULT}), але файлів у Storage не знайдено. Тег: ${TAG_NAME}`);
    return;
  }

  const installers = files.filter((f) => /\.(exe|dmg|AppImage|rpm)$/i.test(f.name));
  const aux = files.filter((f) => !installers.includes(f));
  const tagEsc = escHtml(TAG_NAME);

  const lines = [];
  if (BUILD_RESULT === 'success') {
    lines.push(`✅ Білд готовий: <code>${tagEsc}</code>`);
  } else {
    lines.push(`⚠️ Білд завершився з помилками (${escHtml(BUILD_RESULT)}): <code>${tagEsc}</code>`);
    lines.push('Доступні часткові артефакти:');
  }
  lines.push('');
  lines.push('Інсталери (посилання дійсні 30 днів):');
  for (const f of installers) {
    const url = await signUrl(`${TAG_NAME}/${f.name}`);
    lines.push(`• <a href="${escHtml(url)}">${escHtml(classify(f.name))}</a>`);
  }

  if (aux.length > 0) {
    lines.push('');
    lines.push('Допоміжні (auto-update):');
    for (const f of aux) {
      const url = await signUrl(`${TAG_NAME}/${f.name}`);
      lines.push(`• <a href="${escHtml(url)}">${escHtml(f.name)}</a>`);
    }
  }

  await tg(lines.join('\n'), { html: true });
}

async function cleanupOld() {
  const root = await listFolder('');
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let removedFolders = 0;
  let removedObjects = 0;

  for (const entry of root) {
    if (entry.id !== null) continue; // only folders (id is null for prefixes)
    if (entry.name === TAG_NAME) continue;

    const contents = await listFolder(`${entry.name}/`);
    if (contents.length === 0) continue;

    const newest = Math.max(
      ...contents.map((c) => new Date(c.created_at || c.updated_at || 0).getTime())
    );
    if (newest >= cutoff) continue;

    const paths = contents.map((c) => `${entry.name}/${c.name}`);
    console.log(`Cleanup: ${entry.name} (${paths.length} files, newest=${new Date(newest).toISOString()})`);
    await deleteObjects(paths);
    removedFolders += 1;
    removedObjects += paths.length;
  }

  if (removedFolders > 0) {
    console.log(`Cleanup: removed ${removedFolders} folder(s), ${removedObjects} object(s)`);
  }
}

async function main() {
  await announceBuild();
  try {
    await cleanupOld();
  } catch (err) {
    console.error('Cleanup failed (non-fatal):', err);
  }
}

main().catch(async (err) => {
  console.error(err);
  try {
    await tg(`❌ Помилка фіналізації: ${err.message || err}`);
  } catch {}
  process.exit(1);
});
