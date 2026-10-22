import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import pLimit from 'p-limit';
import pWaitFor from 'p-wait-for';
import { z } from 'zod';
import { parseTasklistCsv } from '../steam-process/list-windows';
import { writeFileAtomic } from './atomic-write';
import { readFileOrNull } from './fs-safe';
import { system32 } from './host-exec';
import { mergeLaunchOptions } from './launch-options-value';
import { deleteStoreValue, readStoreValue, writeStoreValue } from './store-storage';

const execFileAsync = promisify(execFile);

const EGL_IMAGE = 'EpicGamesLauncher.exe';
const ACCOUNT_SECTION = /^\[[0-9a-f]{32}_Settings\]\s*$/i;
const POLL_MS = 15000;
const PENDING_KEY = 'pending-egl-launch-args';
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const UTF16LE_BOM = Buffer.from([0xff, 0xfe]);
const MAX_WRITE_ATTEMPTS = 5;
const ESCAPED: Record<string, string> = {
  '\\': '\\\\',
  '"': '\\"',
  '\r': '\\r',
  '\n': '\\n',
};
const UNESCAPED: Record<string, string> = { n: '\n', r: '\r', t: '\t' };

function getSettingsPath(): string | null {
  const localAppData = process.env.LOCALAPPDATA;
  return localAppData
    ? path.join(
        localAppData,
        'EpicGamesLauncher/Saved/Config/WindowsEditor/GameUserSettings.ini'
      )
    : null;
}

// UE's ini reader unquotes a value that opens with a quote and strips unquoted braces, comments and edge spaces
function toIniValue(value: string): string {
  return /^[\s"]|\s$|\\$|[{}\r\n]|\/\//.test(value)
    ? `"${value.replace(/[\\"\r\n]/g, (char) => ESCAPED[char] ?? char)}"`
    : value;
}

function fromIniValue(raw: string): string {
  const quoted = /^"((?:[^"\\]|\\.)*)"/.exec(raw);
  return quoted
    ? quoted[1].replace(/\\(.)/g, (_, char: string) => UNESCAPED[char] ?? char)
    : raw;
}

function keyValue(line: string, key: string): string | undefined {
  return line.startsWith(`${key}=`) ? line.slice(key.length + 1) : undefined;
}

// Touches only this game's two keys in each account's section; the rest, the login token included, stays as it was
export function withEglLaunchArgs(
  ini: string,
  appId: string,
  argsText: string
): string | null {
  const eol = ini.includes('\r\n') ? '\r\n' : '\n';
  const lines = ini.split(/\r?\n/);
  const enabledKey = `${appId}_AdditionalCommandsEnabled`;
  const commandsKey = `${appId}_AdditionalCommands`;
  const starts = lines.flatMap((line, i) => (ACCOUNT_SECTION.test(line) ? [i] : []));
  if (starts.length === 0) {
    return null;
  }
  const edited = starts.reduceRight((acc, start) => {
    const next = acc.findIndex((line, i) => i > start && line.startsWith('['));
    const end = next === -1 ? acc.length : next;
    const body = acc.slice(start + 1, end);
    const enabled = body.some(
      (line) => keyValue(line, enabledKey)?.toLowerCase() === 'true'
    );
    const current = enabled
      ? fromIniValue(
          body.map((line) => keyValue(line, commandsKey)).find((v) => v !== undefined) ??
            ''
        )
      : '';
    const kept = body.filter(
      (line) =>
        keyValue(line, enabledKey) === undefined &&
        keyValue(line, commandsKey) === undefined
    );
    const content = kept.findLastIndex((line) => line.trim() !== '') + 1;
    const section = [
      ...kept.slice(0, content),
      `${enabledKey}=True`,
      `${commandsKey}=${toIniValue(mergeLaunchOptions(current, argsText))}`,
      ...kept.slice(content),
    ];
    return [...acc.slice(0, start + 1), ...section, ...acc.slice(end)];
  }, lines);
  return edited.join(eol);
}

// UE saves the file as UTF-16LE once a value is not ASCII, so it is written back in the encoding it came in
function decodeIni(buffer: Buffer): { text: string; encode: (text: string) => Buffer } {
  if (buffer.subarray(0, 2).equals(UTF16LE_BOM)) {
    return {
      text: buffer.subarray(2).toString('utf16le'),
      encode: (text) => Buffer.concat([UTF16LE_BOM, Buffer.from(text, 'utf16le')]),
    };
  }
  const bom = buffer.subarray(0, 3).equals(UTF8_BOM) ? UTF8_BOM : Buffer.alloc(0);
  return {
    text: buffer.subarray(bom.length).toString('utf8'),
    encode: (text) => Buffer.concat([bom, Buffer.from(text, 'utf8')]),
  };
}

function writeLaunchArgs(file: string, appId: string, argsText: string): boolean {
  const buffer = readFileOrNull(file);
  if (!buffer) {
    return false;
  }
  const ini = decodeIni(buffer);
  const next = withEglLaunchArgs(ini.text, appId, argsText);
  if (next === null) {
    console.warn('[EGL] No account section to write launch args for:', appId);
    return false;
  }
  // EGL is not running here, so an in-place write cannot race it when Windows refuses the rename
  if (next !== ini.text) {
    writeFileAtomic(file, ini.encode(next), { allowInPlace: true });
  }
  return true;
}

async function isEglRunning(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      system32('tasklist.exe'),
      ['/FI', `IMAGENAME eq ${EGL_IMAGE}`, '/FO', 'CSV', '/NH'],
      { timeout: 10000, windowsHide: true }
    );
    return parseTasklistCsv(stdout, EGL_IMAGE).length > 0;
  } catch {
    // Unknown counts as running: EGL would overwrite the edit
    return true;
  }
}

const pendingSchema = z.record(z.string(), z.string());

function readPending(): Record<string, string> {
  const parsed = pendingSchema.safeParse(readStoreValue(PENDING_KEY));
  return parsed.success ? parsed.data : {};
}

function writePending(pending: Record<string, string>): void {
  if (Object.keys(pending).length === 0) {
    deleteStoreValue(PENDING_KEY);
    return;
  }
  writeStoreValue(PENDING_KEY, pending);
}

const edits = pLimit(1);
const watcher: { running?: Promise<unknown> } = {};
const failedWrites = new Map<string, number>();

function writeOrRetry(file: string, appId: string, argsText: string): boolean {
  try {
    writeLaunchArgs(file, appId, argsText);
    failedWrites.delete(appId);
    return false;
  } catch (error) {
    const attempts = (failedWrites.get(appId) ?? 0) + 1;
    failedWrites.set(appId, attempts);
    console.warn(
      `[EGL] Launch args write failed (${attempts}/${MAX_WRITE_ATTEMPTS}):`,
      error
    );
    return attempts < MAX_WRITE_ATTEMPTS;
  }
}

// EGL reads the file only when it starts and writes its own copy back on launch, game exit and quit
export function flushEglLaunchArgs(): Promise<void> {
  return edits(async () => {
    const file = getSettingsPath();
    if (!file || Object.keys(readPending()).length === 0 || (await isEglRunning())) {
      return;
    }
    writePending(
      Object.fromEntries(
        Object.entries(readPending()).filter(([appId, argsText]) =>
          writeOrRetry(file, appId, argsText)
        )
      )
    );
  });
}

function watchEglExit(): void {
  watcher.running ??= pWaitFor(
    async () => {
      await flushEglLaunchArgs();
      return Object.keys(readPending()).length === 0;
    },
    { interval: POLL_MS }
  )
    .catch((error: unknown) => {
      console.warn('[EGL] Launch args queue stopped:', error);
    })
    .finally(() => {
      watcher.running = undefined;
    });
}

// Args queued before LBK last quit still wait for EGL to exit
export function startPendingEglLaunchArgs(): void {
  if (Object.keys(readPending()).length > 0) {
    watchEglExit();
  }
}

export type EglLaunchArgsResult = 'written' | 'queued' | 'failed';

// Written now when EGL is not running, otherwise once it exits while LBK runs
export function setEglWindowsLaunchArgs(
  appId: string,
  argsText: string
): Promise<EglLaunchArgsResult> {
  return edits(async () => {
    const file = getSettingsPath();
    if (!file || !fs.existsSync(file)) {
      return 'failed';
    }
    const pending = readPending();
    if (await isEglRunning()) {
      writePending({ ...pending, [appId]: argsText });
      watchEglExit();
      return 'queued';
    }
    // An older queued value must not land on top of this one later
    writePending(
      Object.fromEntries(Object.entries(pending).filter(([id]) => id !== appId))
    );
    return writeLaunchArgs(file, appId, argsText) ? 'written' : 'failed';
  });
}
