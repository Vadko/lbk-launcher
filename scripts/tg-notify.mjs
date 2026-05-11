#!/usr/bin/env node
/**
 * Sends a status message to the Telegram thread of a TG-triggered build.
 * Templates live here so non-ASCII text never passes through Windows Git Bash
 * (which mangles UTF-8 in curl --data-urlencode).
 *
 * Usage: node scripts/tg-notify.mjs <kind>
 * Required env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_THREAD_ID
 * Per-kind env (see KINDS below).
 */

const {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  TELEGRAM_THREAD_ID,
  TRIGGERED_BY,
  TAG_NAME,
  PLATFORM,
  RUN_URL,
} = process.env;

const kind = process.argv[2];

const KINDS = {
  start: () => `🔄 Старт від ${TRIGGERED_BY || 'unknown'}: мерджу main → admin-version...`,
  merge_conflict: () => `❌ Конфлікт мержу main → admin-version. Розрули вручну й перезапусти.`,
  build_start: () => `🏗 Мерж ок. Білджу 3 платформи. Тег: ${TAG_NAME}`,
  platform_success: () => `✅ ${PLATFORM}: готово`,
  platform_failure: () => `❌ ${PLATFORM}: збій. Логи: ${RUN_URL}`,
};

if (!KINDS[kind]) {
  console.error(`unknown kind: ${kind}. allowed: ${Object.keys(KINDS).join(', ')}`);
  process.exit(2);
}
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !TELEGRAM_THREAD_ID) {
  console.error('missing TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID / TELEGRAM_THREAD_ID');
  process.exit(2);
}

const text = KINDS[kind]();

const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: Number(TELEGRAM_CHAT_ID),
    message_thread_id: Number(TELEGRAM_THREAD_ID),
    text,
    disable_web_page_preview: true,
  }),
});

if (!res.ok) {
  console.error(`TG notify (${kind}) failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
