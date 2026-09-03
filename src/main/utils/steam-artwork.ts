/**
 * Install the translator's Ukrainian cover art into the user's Steam library.
 *
 * Artwork slots in `userdata/{userId}/config/grid/`, mapped empirically against
 * build 1785799196 (the client doesn't export the enum):
 *
 *   1 → `{appId}_hero` ← banner_path   2 → `{appId}_logo` ← logo_path
 *   3 → `{appId}`      ← capsule_path, landscape 616x353 despite the name
 *
 * Slot 0 (`{appId}p`, the 600x900 vertical capsule) has no source, so we leave
 * it alone. Steam probes a hardcoded `["jpg","png"]`, so WebP is stored but
 * never rendered — ours are transcoded, and a pre-existing `.jpg` is moved
 * aside rather than copied, or it would beat the `.png` we write.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import got from 'got';
import { getSteamGridPath } from '@/main/game-detector/steam';
import { evaluateInSharedJsContext, isCefUsable } from '@/main/utils/steam-cef';
import { readRendererSetting } from '@/main/utils/store-storage';
import { getMainWindow } from '@/main/window';

const DOWNLOAD_TIMEOUT_MS = 15_000;
const DOWNLOAD_RETRY_LIMIT = 1;
/** Chromium can wedge (renderer reload, crash); never block the install on it. */
const TRANSCODE_TIMEOUT_MS = 15_000;

/** Extensions Steam actually probes for. Anything else has to be transcoded. */
type SteamImageExtension = 'jpg' | 'png';
const STEAM_EXTENSIONS: SteamImageExtension[] = ['jpg', 'png'];

/** The three slots we have artwork for. `header` has no filename suffix. */
export const ARTWORK_SLOTS = [
  { key: 'header', assetType: 3, suffix: '' },
  { key: 'hero', assetType: 1, suffix: '_hero' },
  { key: 'logo', assetType: 2, suffix: '_logo' },
] as const;

const [HEADER_SLOT, HERO_SLOT, LOGO_SLOT] = ARTWORK_SLOTS;

type ArtworkSlot = (typeof ARTWORK_SLOTS)[number];
type ArtworkSlotKey = ArtworkSlot['key'];

interface SteamArtworkParams {
  appId: number;
  capsulePath: string | null;
  bannerPath: string | null;
  logoPath: string | null;
  updatedAt?: string | null;
}

type ApplyMode =
  | 'noop' // disabled, no sources, or nothing could be prepared
  | 'cef' // pushed live through Steam's CEF API
  | 'file'; // written to grid/, visible after Steam restarts

interface SteamArtworkResult {
  mode: ApplyMode;
  installed: ArtworkSlotKey[];
  reason?: string;
}

interface ArtworkRecordEntry {
  name: string;
  hash: string;
  assetType: number;
}

interface ArtworkRecord {
  written: ArtworkRecordEntry[];
  backups: Record<string, string>;
}

/** User opt-out from the Settings modal. */
function isSteamArtworkEnabledInSettings(): boolean {
  return readRendererSetting('steamCustomArtworkEnabled', true);
}

function sha256(bytes: Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function hashFile(filePath: string): string | null {
  try {
    return sha256(fs.readFileSync(filePath));
  } catch {
    return null;
  }
}

/** Reject after `ms` so a wedged dependency can't hang the install forever. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

// ---------------------------------------------------------------------------
// Bookkeeping
// ---------------------------------------------------------------------------

function getArtworkStateDir(): string {
  return path.join(app.getPath('userData'), 'steam-artwork');
}

function getRecordPath(appId: number): string {
  return path.join(getArtworkStateDir(), `${appId}.json`);
}

function readRecord(appId: number): ArtworkRecord | null {
  try {
    const raw = fs.readFileSync(getRecordPath(appId), 'utf8');
    const parsed = JSON.parse(raw) as Partial<ArtworkRecord>;
    const written = Array.isArray(parsed.written)
      ? parsed.written.filter(
          (entry): entry is ArtworkRecordEntry =>
            typeof entry?.name === 'string' &&
            typeof entry?.hash === 'string' &&
            typeof entry?.assetType === 'number'
        )
      : [];
    return { written, backups: parsed.backups ?? {} };
  } catch {
    return null;
  }
}

function writeRecord(appId: number, record: ArtworkRecord): void {
  try {
    fs.mkdirSync(getArtworkStateDir(), { recursive: true });
    fs.writeFileSync(getRecordPath(appId), JSON.stringify(record, null, 2), 'utf8');
  } catch (error) {
    console.warn(`[SteamArtwork] Failed to persist record for ${appId}:`, error);
  }
}

function deleteRecord(appId: number): void {
  try {
    fs.unlinkSync(getRecordPath(appId));
  } catch {
    // Never existed, or already gone — either way the desired end state.
  }
}

/** True when the file on disk is still byte-for-byte what we put there. */
function isStillOurs(gridDir: string, entry: ArtworkRecordEntry): boolean {
  return hashFile(path.join(gridDir, entry.name)) === entry.hash;
}

// ---------------------------------------------------------------------------
// Fetching and decoding
// ---------------------------------------------------------------------------

/**
 * Main-process twin of the renderer's `getImageUrl` (`src/lib/api.ts`). The
 * `?v=` cache-buster matters here too — artwork is replaced in place upstream.
 */
function buildStorageUrl(imagePath: string, updatedAt?: string | null): string | null {
  let url: string;
  if (imagePath.startsWith('http')) {
    url = imagePath;
  } else {
    const base = import.meta.env.VITE_STORAGE_IMAGES_URL;
    if (!base) {
      return null;
    }
    url = `${base}/${imagePath.startsWith('/') ? imagePath.slice(1) : imagePath}`;
  }

  if (!updatedAt) {
    return url;
  }
  const stamp = new Date(updatedAt).getTime();
  if (Number.isNaN(stamp)) {
    return url;
  }
  return `${url}${url.includes('?') ? '&' : '?'}v=${stamp}`;
}

/** Sniff the real format instead of trusting the file extension in the path. */
function detectImageFormat(bytes: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  if (bytes.length >= 8 && bytes.readUInt32BE(0) === 0x89504e47) {
    return 'png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  return null;
}

/**
 * Transcode to PNG by borrowing the renderer's Chromium — `nativeImage` returns
 * an empty image for WebP. Bytes go in as a `data:` URL (same-origin, so the
 * canvas stays untainted no matter what CORS headers the storage host sends).
 */
async function transcodeToPng(
  bytes: Buffer,
  sourceFormat: string
): Promise<Buffer | null> {
  const window = getMainWindow();
  if (!window || window.webContents.isDestroyed()) {
    return null;
  }

  const dataUrl = `data:image/${sourceFormat};base64,${bytes.toString('base64')}`;
  const script = `(async () => {
    const img = new Image();
    img.src = ${JSON.stringify(dataUrl)};
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) { return null; }
    ctx.drawImage(img, 0, 0);
    const url = canvas.toDataURL('image/png');
    return url.slice(url.indexOf(',') + 1);
  })()`;

  try {
    // `executeJavaScript` never settles if the renderer dies mid-call, and the
    // check above only covers the state before it.
    const base64 = await withTimeout(
      window.webContents.executeJavaScript(script, true),
      TRANSCODE_TIMEOUT_MS,
      'PNG transcode'
    );
    return typeof base64 === 'string' && base64.length > 0
      ? Buffer.from(base64, 'base64')
      : null;
  } catch (error) {
    console.warn('[SteamArtwork] PNG transcode failed:', error);
    return null;
  }
}

interface PreparedAsset {
  slot: ArtworkSlot;
  bytes: Buffer;
  extension: SteamImageExtension;
}

/** Download one asset and get it into a format Steam will actually display. */
async function prepareAsset(
  slot: ArtworkSlot,
  imagePath: string,
  updatedAt?: string | null
): Promise<PreparedAsset | null> {
  const url = buildStorageUrl(imagePath, updatedAt);
  if (!url) {
    return null;
  }

  let bytes: Buffer;
  try {
    bytes = await got(url, {
      responseType: 'buffer',
      timeout: { request: DOWNLOAD_TIMEOUT_MS },
      retry: { limit: DOWNLOAD_RETRY_LIMIT },
    }).buffer();
  } catch (error) {
    console.warn(`[SteamArtwork] Failed to download ${slot.key} from ${url}:`, error);
    return null;
  }

  const format = detectImageFormat(bytes);
  if (format === 'png' || format === 'jpg') {
    return { slot, bytes, extension: format };
  }

  // WebP (the common case) and anything unrecognised go through Chromium.
  const png = await transcodeToPng(bytes, format ?? 'webp');
  if (!png) {
    console.warn(
      `[SteamArtwork] Could not transcode ${slot.key} (${format ?? 'unknown'})`
    );
    return null;
  }
  return { slot, bytes: png, extension: 'png' };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** Every filename Steam might read for one slot, whoever wrote it. */
function gridFileNamesForSlot(appId: number, slot: ArtworkSlot): string[] {
  return STEAM_EXTENSIONS.map((extension) => `${appId}${slot.suffix}.${extension}`);
}

/**
 * Clear one slot so our image is the only candidate Steam can find. Files whose
 * hash we recorded are our own leftovers and just get deleted; anything else is
 * the user's and is moved (not copied — a leftover `.jpg` beats our `.png`).
 */
function displaceExistingArtwork(
  gridDir: string,
  appId: number,
  slot: ArtworkSlot,
  ours: Map<string, ArtworkRecordEntry>,
  backups: Record<string, string>
): void {
  for (const fileName of gridFileNamesForSlot(appId, slot)) {
    const fullPath = path.join(gridDir, fileName);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const prior = ours.get(fileName);
    if (prior && hashFile(fullPath) === prior.hash) {
      try {
        fs.unlinkSync(fullPath);
      } catch (error) {
        console.warn(`[SteamArtwork] Failed to clear our old ${fileName}:`, error);
      }
      continue;
    }

    try {
      const backupDir = getArtworkStateDir();
      fs.mkdirSync(backupDir, { recursive: true });
      const backupName = `${appId}${slot.suffix}.user.${path.extname(fileName).slice(1)}`;
      // Overwrites any earlier backup on purpose — the newest is what they'd want back.
      fs.copyFileSync(fullPath, path.join(backupDir, backupName));
      fs.unlinkSync(fullPath);
      backups[fileName] = backupName;
      console.log(`[SteamArtwork] Backed up user artwork ${fileName}`);
    } catch (error) {
      console.warn(`[SteamArtwork] Failed to back up ${fileName}:`, error);
    }
  }
}

function artworkFileName(appId: number, suffix: string, extension: string): string {
  return `${appId}${suffix}.${extension}`;
}

interface ArtworkSlotWrite {
  appId: number;
  assetType: number;
  suffix: string;
  extension: string;
  bytes: Buffer;
  gridDir: string | null;
  cefUsable: boolean;
  label: string;
}

export async function applyArtworkSlot(
  write: ArtworkSlotWrite
): Promise<'cef' | 'file' | null> {
  if (write.cefUsable) {
    try {
      await evaluateInSharedJsContext(
        `SteamClient.Apps.SetCustomArtworkForApp(${write.appId}, ${JSON.stringify(
          write.bytes.toString('base64')
        )}, ${JSON.stringify(write.extension)}, ${write.assetType})`
      );
      return 'cef';
    } catch (error) {
      console.warn(
        `[SteamArtwork] CEF apply failed for ${write.label}, writing file instead:`,
        error
      );
    }
  }

  if (!write.gridDir) {
    return null;
  }
  try {
    fs.mkdirSync(write.gridDir, { recursive: true });
    const target = path.join(
      write.gridDir,
      artworkFileName(write.appId, write.suffix, write.extension)
    );
    // Write beside the target then rename, so Steam can't read a half-written image.
    const tmp = `${target}.lbk.tmp`;
    fs.writeFileSync(tmp, write.bytes);
    fs.renameSync(tmp, target);
    return 'file';
  } catch (error) {
    console.warn(`[SteamArtwork] Failed to apply ${write.label}:`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Install header / hero / logo. Best-effort: a slot that can't be downloaded or
 * decoded is skipped, and the rest still land.
 */
export async function applySteamArtwork(
  params: SteamArtworkParams
): Promise<SteamArtworkResult> {
  if (!isSteamArtworkEnabledInSettings()) {
    return { mode: 'noop', installed: [], reason: 'Disabled in settings' };
  }

  const sources: Array<[ArtworkSlot, string | null]> = [
    [HEADER_SLOT, params.capsulePath],
    [HERO_SLOT, params.bannerPath],
    [LOGO_SLOT, params.logoPath],
  ];
  const available = sources.filter((entry): entry is [ArtworkSlot, string] =>
    Boolean(entry[1])
  );
  if (available.length === 0) {
    return { mode: 'noop', installed: [], reason: 'No artwork for this game' };
  }

  const gridDir = getSteamGridPath();
  if (!gridDir) {
    return { mode: 'noop', installed: [], reason: 'Steam user folder not found' };
  }

  const prepared = (
    await Promise.all(
      available.map(([slot, imagePath]) =>
        prepareAsset(slot, imagePath, params.updatedAt)
      )
    )
  ).filter((asset): asset is PreparedAsset => asset !== null);

  if (prepared.length === 0) {
    return { mode: 'noop', installed: [], reason: 'No artwork could be prepared' };
  }

  const previous = readRecord(params.appId);
  const priorByName = new Map(
    (previous?.written ?? []).map((entry) => [entry.name, entry])
  );
  const backups: Record<string, string> = { ...(previous?.backups ?? {}) };

  for (const asset of prepared) {
    displaceExistingArtwork(gridDir, params.appId, asset.slot, priorByName, backups);
  }

  // Files from an earlier install whose slot failed this time are still ours —
  // carry them over, or uninstall could never remove them.
  const refreshedTypes = new Set<number>(prepared.map((asset) => asset.slot.assetType));
  const written: ArtworkRecordEntry[] = (previous?.written ?? []).filter(
    (entry) => !refreshedTypes.has(entry.assetType) && isStillOurs(gridDir, entry)
  );

  const cefUsable = await isCefUsable();
  const installed: ArtworkSlotKey[] = [];
  let anyViaFile = false;

  for (const asset of prepared) {
    const mode = await applyArtworkSlot({
      appId: params.appId,
      assetType: asset.slot.assetType,
      suffix: asset.slot.suffix,
      extension: asset.extension,
      bytes: asset.bytes,
      gridDir,
      cefUsable,
      label: asset.slot.key,
    });
    const applied = mode !== null;
    if (mode === 'file') {
      anyViaFile = true;
    }

    if (applied) {
      written.push({
        name: artworkFileName(params.appId, asset.slot.suffix, asset.extension),
        hash: sha256(asset.bytes),
        assetType: asset.slot.assetType,
      });
      installed.push(asset.slot.key);
    }
  }

  // Persist even on total failure — user files may already have been moved
  // aside, and those backups need an owner.
  writeRecord(params.appId, { written, backups });

  if (installed.length === 0) {
    return { mode: 'noop', installed: [], reason: 'Every slot failed to apply' };
  }

  const mode: ApplyMode = anyViaFile || !cefUsable ? 'file' : 'cef';
  console.log(
    `[SteamArtwork] App ${params.appId} installed ${installed.join(', ')} via ${mode}`
  );
  return { mode, installed };
}

/**
 * Undo `applySteamArtwork` — remove the files we wrote, restore what the user
 * had before. A no-op when we never touched this app.
 */
export async function removeSteamArtwork(appId: number): Promise<boolean> {
  const record = readRecord(appId);
  if (!record) {
    return false;
  }

  const gridDir = getSteamGridPath();
  if (!gridDir) {
    return false;
  }

  const cefUsable = await isCefUsable();

  for (const entry of record.written) {
    const fullPath = path.join(gridDir, entry.name);
    if (!fs.existsSync(fullPath)) {
      continue;
    }
    // Replaced by the user since — leave it, and skip the CEF clear too, which
    // would delete their file.
    if (hashFile(fullPath) !== entry.hash) {
      console.log(`[SteamArtwork] ${entry.name} was replaced by the user, keeping it`);
      continue;
    }

    // Clearing via CEF drops the running client's cached image too, so the
    // library stops showing our art without a restart.
    if (cefUsable) {
      try {
        await evaluateInSharedJsContext(
          `SteamClient.Apps.ClearCustomArtworkForApp(${appId}, ${entry.assetType})`
        );
      } catch (error) {
        console.warn(`[SteamArtwork] CEF clear failed for ${entry.name}:`, error);
      }
    }

    try {
      fs.unlinkSync(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`[SteamArtwork] Failed to remove ${entry.name}:`, error);
      }
    }
  }

  let restoreFailed = false;
  for (const [gridName, backupName] of Object.entries(record.backups)) {
    const backupPath = path.join(getArtworkStateDir(), backupName);
    if (!fs.existsSync(backupPath)) {
      continue;
    }
    try {
      fs.mkdirSync(gridDir, { recursive: true });
      fs.copyFileSync(backupPath, path.join(gridDir, gridName));
      fs.unlinkSync(backupPath);
      console.log(`[SteamArtwork] Restored user artwork ${gridName}`);
    } catch (error) {
      restoreFailed = true;
      console.warn(`[SteamArtwork] Failed to restore ${gridName}:`, error);
    }
  }

  if (restoreFailed) {
    // Keep the record — it's the only thing pointing at the surviving backups.
    console.warn(`[SteamArtwork] App ${appId} partially reverted, keeping record`);
    return false;
  }

  deleteRecord(appId);
  console.log(`[SteamArtwork] App ${appId} artwork reverted`);
  return true;
}

/** Revert every app we've touched — used when the setting is switched off. */
export async function removeAllSteamArtwork(): Promise<number> {
  let entries: string[];
  try {
    entries = fs.readdirSync(getArtworkStateDir());
  } catch {
    return 0; // Nothing was ever installed.
  }

  let reverted = 0;
  for (const fileName of entries) {
    const match = fileName.match(/^(\d+)\.json$/);
    if (!match) {
      continue;
    }
    if (await removeSteamArtwork(Number(match[1]))) {
      reverted++;
    }
  }

  console.log(`[SteamArtwork] Reverted artwork for ${reverted} app(s)`);
  return reverted;
}
