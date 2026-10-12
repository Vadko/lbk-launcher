/**
 * Xbox Games / Microsoft Store / Game Pass Detection
 *
 * Detects games installed via Xbox app or Microsoft Store. Such games are
 * stored on a per-drive basis under a folder pointed to by `.GamingRoot` at
 * the drive root (e.g. `D:\.GamingRoot`). Each game lives under
 * `<drive>:\<gamingRoot>\<GameFolder>\Content\` (the `Content` subfolder is
 * the actual game install — that's what we expose as the game path so
 * archives that mirror the game's directory structure can be applied).
 *
 * `.GamingRoot` binary format (little-endian):
 *   - 4-byte magic 'RGBX' (0x52 0x47 0x42 0x58)
 *   - 4-byte uint32 folder count (usually 1, but spec allows >1)
 *   - For each folder: a null-terminated UTF-16-LE string with the path
 *     relative to the drive root (typically "XboxGames").
 *
 * Reference: erri120/GameFinder (used by Nexus Mods App) — the canonical
 * open-source parser. Vortex's TS port handles only single-folder files.
 * We follow GameFinder's loop to also support the (rare) multi-folder case.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { InstallPath } from '../../shared/types';
import { isWindows } from '../utils/platform';
import { logIfChanged } from './log-if-changed';

const GAMING_ROOT_FILE = '.GamingRoot';
const GAMING_ROOT_MAGIC = 'RGBX';
// Sanity bound on folder count — matches GameFinder; real files have count=1.
const MAX_FOLDER_COUNT = 255;

interface XboxRoot {
  drive: string; // e.g. "D:\"
  gamingRootPath: string; // absolute path, e.g. "D:\XboxGames"
}

/**
 * Read a null-terminated UTF-16-LE string from `buffer` starting at `start`.
 * Returns the decoded text and the offset of the byte after the terminator,
 * or null if no terminator was found.
 *
 * Note: Node's `Buffer.indexOf` and `smart-buffer.readStringNT` both treat the
 * terminator as a single 0x00 byte, which corrupts UTF-16 (e.g. ASCII chars
 * have a 0x00 high byte). We need a 2-byte aligned scan for char16_t == 0.
 */
function readNullTerminatedUtf16LE(
  buffer: Buffer,
  start: number
): { text: string; next: number } | null {
  for (let i = start; i + 1 < buffer.length; i += 2) {
    if (buffer.readUInt16LE(i) === 0) {
      return { text: buffer.toString('utf16le', start, i), next: i + 2 };
    }
  }
  return null;
}

/**
 * Parse a .GamingRoot file and return all relative folder paths it points to.
 * Returns an empty array if the file is not a valid GamingRoot blob.
 */
function parseGamingRoot(filePath: string, buffer: Buffer): string[] {
  try {
    if (buffer.length < 8) {
      return [];
    }

    if (buffer.toString('ascii', 0, 4) !== GAMING_ROOT_MAGIC) {
      console.warn(`[Xbox] ${filePath} has unexpected magic`);
      return [];
    }

    const folderCount = buffer.readUInt32LE(4);
    if (folderCount === 0 || folderCount > MAX_FOLDER_COUNT) {
      console.warn(`[Xbox] ${filePath} folder count out of range: ${folderCount}`);
      return [];
    }

    const folders: string[] = [];
    let cursor = 8;
    for (let i = 0; i < folderCount; i++) {
      const entry = readNullTerminatedUtf16LE(buffer, cursor);
      if (!entry) {
        console.warn(
          `[Xbox] ${filePath} ran out of bytes while reading folder ${i + 1}/${folderCount}`
        );
        break;
      }
      // Strip a leading ".\" if present (some files include it).
      const cleaned = entry.text.replace(/^\.[\\/]/, '').trim();
      if (cleaned) {
        folders.push(cleaned);
      }
      cursor = entry.next;
    }
    return folders;
  } catch (error) {
    console.error(`[Xbox] Failed to parse ${filePath}:`, error);
    return [];
  }
}

// A dead network drive can hang access for seconds: scan async, one drive at a time; sync readers get the last result
const DRIVE_TIMEOUT_MS = 2000;
// Each hung access pins one of libuv's 4 threads until the OS gives up, so a scan stops probing at this many
const MAX_STUCK_DRIVES = 2;
const DRIVE_LETTERS = Array.from(
  { length: 26 },
  (_, i) => `${String.fromCharCode(65 + i)}:\\`
);
const TIMED_OUT = Symbol('timed-out');

let roots: XboxRoot[] = [];
let hasScanned = false;
let inFlightScan: Promise<boolean> | null = null;
// Drives whose marker read outlived the timeout and is still running
const stuckDrives = new Set<string>();
// Slow and then failed: treated as dead until resume
const deadDrives = new Set<string>();
const rootsListeners = new Set<() => void>();

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function readDriveRoots(drive: string): Promise<XboxRoot[] | typeof TIMED_OUT> {
  const markerPath = path.join(drive, GAMING_ROOT_FILE);
  const read = fs.promises.readFile(markerPath).catch(() => null);
  const marker = await withTimeout(read, DRIVE_TIMEOUT_MS);

  if (marker === TIMED_OUT) {
    // A timeout alone proves nothing (HDD spin-up, a busy main thread); the read's own outcome decides
    stuckDrives.add(drive);
    void read.then((late) => {
      stuckDrives.delete(drive);
      if (late) {
        void refreshXboxRoots();
      } else {
        deadDrives.add(drive);
      }
    });
    return TIMED_OUT;
  }
  if (!marker) {
    return [];
  }

  const driveRoots: XboxRoot[] = [];
  for (const relative of parseGamingRoot(markerPath, marker)) {
    const gamingRootPath = path.join(drive, relative);
    const exists = await fs.promises.access(gamingRootPath).then(
      () => true,
      () => false
    );
    if (exists) {
      driveRoots.push({ drive, gamingRootPath });
    }
  }
  return driveRoots;
}

const rootsKey = (list: XboxRoot[]) => list.map((root) => root.gamingRootPath).join('|');

async function scanXboxRoots(): Promise<boolean> {
  const next: XboxRoot[] = [];
  // A drive we can't read right now keeps the roots it had, so its games don't flicker out
  const keepKnownRoots = (drive: string) =>
    next.push(...roots.filter((root) => root.drive === drive));

  for (const drive of DRIVE_LETTERS) {
    if (
      deadDrives.has(drive) ||
      stuckDrives.has(drive) ||
      stuckDrives.size >= MAX_STUCK_DRIVES
    ) {
      keepKnownRoots(drive);
      continue;
    }
    const found = await readDriveRoots(drive);
    if (found === TIMED_OUT) {
      console.warn(`[Xbox] Drive ${drive} is slow to respond, keeping its known roots`);
      keepKnownRoots(drive);
    } else {
      next.push(...found);
    }
  }

  const changed = rootsKey(next) !== rootsKey(roots);
  roots = next;
  hasScanned = true;
  if (changed) {
    console.log(`[Xbox] Xbox roots: ${rootsKey(roots) || 'none'}`);
    for (const listener of rootsListeners) {
      try {
        listener();
      } catch (error) {
        console.error('[Xbox] Roots listener failed:', error);
      }
    }
  }
  return changed;
}

/** Resolves to whether the set of Xbox roots changed. */
export function refreshXboxRoots({ retryDeadDrives = false } = {}): Promise<boolean> {
  if (!isWindows()) {
    return Promise.resolve(false);
  }
  if (retryDeadDrives) {
    deadDrives.clear();
    // A scan already under way skipped those drives, so queue a fresh one behind it
    if (inFlightScan) {
      return inFlightScan.then(() => refreshXboxRoots());
    }
  }
  inFlightScan ??= scanXboxRoots().finally(() => {
    inFlightScan = null;
  });
  return inFlightScan;
}

/** Waits for the first scan, so list-style readers never answer from the empty initial state. */
export async function whenXboxRootsScanned(): Promise<void> {
  if (isWindows() && !hasScanned) {
    await refreshXboxRoots();
  }
}

/** Before resolving one game's folder: roots may be stale for a drive attached since the last scan. */
export async function refreshXboxRootsForGame(
  installPaths: InstallPath[] | null | undefined
): Promise<void> {
  if (installPaths?.some((installPath) => installPath.type === 'xbox')) {
    await refreshXboxRoots();
  }
}

export function onXboxRootsChanged(listener: () => void): () => void {
  rootsListeners.add(listener);
  return () => rootsListeners.delete(listener);
}

export function getXboxRootPaths(): string[] {
  return getXboxRoots().map((root) => root.gamingRootPath);
}

function getXboxRoots(): XboxRoot[] {
  if (!hasScanned) {
    void refreshXboxRoots();
  }
  return roots;
}

/**
 * Return a map of folder name (lowercased) -> absolute Content path for
 * every game discovered across all Xbox roots.
 */
function getXboxGamePaths(): Map<string, string> {
  const games = new Map<string, string>();
  if (!isWindows()) {
    return games;
  }

  try {
    for (const root of getXboxRoots()) {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(root.gamingRootPath, { withFileTypes: true });
      } catch (err) {
        // Usually a removed drive: rescan roots instead of failing on every probe
        console.warn(`[Xbox] Cannot read ${root.gamingRootPath}:`, err);
        void refreshXboxRoots();
        continue;
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const gameFolder = path.join(root.gamingRootPath, entry.name);
        // Xbox installs put the playable game under a `Content` subfolder.
        // Fall back to the game folder itself if `Content` doesn't exist
        // (some package layouts skip it).
        const contentPath = path.join(gameFolder, 'Content');
        const resolved = fs.existsSync(contentPath) ? contentPath : gameFolder;

        const key = entry.name.toLowerCase();
        if (!games.has(key)) {
          games.set(key, resolved);
        }
      }
    }
  } catch (error) {
    console.error('[Xbox] Error enumerating Xbox games:', error);
  }

  if (games.size > 0) {
    logIfChanged('xbox-games', `[Xbox] Games found: ${[...games.values()].join(', ')}`);
  }
  return games;
}

/**
 * Find an Xbox-installed game by folder name (case-insensitive). Returns the
 * absolute path to the game's Content directory, or null if not installed.
 */
export function findXboxGame(gameFolderName: string): string | null {
  if (!isWindows()) {
    return null;
  }

  console.log(`[Xbox] Searching for game: "${gameFolderName}"`);
  const found = matchXboxGame(getXboxGamePaths(), gameFolderName);
  if (!found) {
    // The game may sit on a drive attached after the last scan; the rescan reports back via onXboxRootsChanged
    void refreshXboxRoots();
    console.warn(`[Xbox] ✗ Game "${gameFolderName}" not found`);
  }
  return found;
}

function matchXboxGame(
  games: Map<string, string>,
  gameFolderName: string
): string | null {
  const exact = games.get(gameFolderName.toLowerCase());
  if (exact && fs.existsSync(exact)) {
    console.log(`[Xbox] ✓ Game found: ${gameFolderName} at ${exact}`);
    return exact;
  }

  // Partial match — Xbox folder names sometimes include publisher prefixes
  // or version suffixes that the metadata folder name omits.
  const target = gameFolderName.toLowerCase();
  for (const [folderName, fullPath] of games.entries()) {
    if (folderName.includes(target) || target.includes(folderName)) {
      if (fs.existsSync(fullPath)) {
        console.log(
          `[Xbox] ✓ Game found (partial match): ${gameFolderName} -> ${fullPath}`
        );
        return fullPath;
      }
    }
  }

  return null;
}

/**
 * Return folder names of every Xbox game on the system. Used to build the
 * "installed games on this PC" list for the launcher's library matching.
 */
export function getInstalledXboxGamePaths(): string[] {
  if (!isWindows()) {
    return [];
  }

  const paths: string[] = [];
  try {
    for (const folderName of getXboxGamePaths().keys()) {
      paths.push(folderName);
    }
  } catch (error) {
    console.error('[Xbox] Error getting installed paths:', error);
  }
  return paths;
}
