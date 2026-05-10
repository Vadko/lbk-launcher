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
import { isWindows } from '../utils/platform';

const GAMING_ROOT_FILE = '.GamingRoot';
const GAMING_ROOT_MAGIC = 'RGBX';
// Sanity bound on folder count — matches GameFinder; real files have count=1.
const MAX_FOLDER_COUNT = 255;

interface XboxRoot {
  drive: string; // e.g. "D:\"
  gamingRootPath: string; // absolute path, e.g. "D:\XboxGames"
}

/**
 * List drive letters available on Windows (e.g. ["C:\\", "D:\\"]).
 */
function getWindowsDrives(): string[] {
  if (!isWindows()) return [];

  const drives: string[] = [];
  // Iterate A..Z; existsSync on a drive root is fast and avoids spawning wmic.
  for (let charCode = 'A'.charCodeAt(0); charCode <= 'Z'.charCodeAt(0); charCode++) {
    const drive = `${String.fromCharCode(charCode)}:\\`;
    try {
      if (fs.existsSync(drive)) {
        drives.push(drive);
      }
    } catch {
      // Inaccessible drive (e.g. unmounted CD-ROM) — skip.
    }
  }
  return drives;
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
function parseGamingRoot(filePath: string): string[] {
  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 8) return [];

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
      if (cleaned) folders.push(cleaned);
      cursor = entry.next;
    }
    return folders;
  } catch (error) {
    console.error(`[Xbox] Failed to parse ${filePath}:`, error);
    return [];
  }
}

/**
 * Scan all available Windows drives for `.GamingRoot` markers and return
 * the resolved Xbox install roots.
 */
function getXboxRoots(): XboxRoot[] {
  if (!isWindows()) return [];

  const roots: XboxRoot[] = [];
  for (const drive of getWindowsDrives()) {
    const markerPath = path.join(drive, GAMING_ROOT_FILE);
    if (!fs.existsSync(markerPath)) continue;

    for (const relative of parseGamingRoot(markerPath)) {
      const gamingRootPath = path.join(drive, relative);
      if (fs.existsSync(gamingRootPath)) {
        roots.push({ drive, gamingRootPath });
        console.log(`[Xbox] Found Xbox root at ${gamingRootPath}`);
      }
    }
  }
  return roots;
}

/**
 * Return a map of folder name (lowercased) -> absolute Content path for
 * every game discovered across all Xbox roots.
 */
function getXboxGamePaths(): Map<string, string> {
  const games = new Map<string, string>();
  if (!isWindows()) return games;

  try {
    for (const root of getXboxRoots()) {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(root.gamingRootPath, { withFileTypes: true });
      } catch (err) {
        console.error(`[Xbox] Cannot read ${root.gamingRootPath}:`, err);
        continue;
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const gameFolder = path.join(root.gamingRootPath, entry.name);
        // Xbox installs put the playable game under a `Content` subfolder.
        // Fall back to the game folder itself if `Content` doesn't exist
        // (some package layouts skip it).
        const contentPath = path.join(gameFolder, 'Content');
        const resolved = fs.existsSync(contentPath) ? contentPath : gameFolder;

        const key = entry.name.toLowerCase();
        if (!games.has(key)) {
          games.set(key, resolved);
          console.log(`[Xbox] Game found: ${entry.name} at ${resolved}`);
        }
      }
    }
  } catch (error) {
    console.error('[Xbox] Error enumerating Xbox games:', error);
  }

  return games;
}

/**
 * Find an Xbox-installed game by folder name (case-insensitive). Returns the
 * absolute path to the game's Content directory, or null if not installed.
 */
export function findXboxGame(gameFolderName: string): string | null {
  if (!isWindows()) return null;

  console.log(`[Xbox] Searching for game: "${gameFolderName}"`);
  const games = getXboxGamePaths();

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

  console.warn(`[Xbox] ✗ Game "${gameFolderName}" not found`);
  return null;
}

/**
 * Return folder names of every Xbox game on the system. Used to build the
 * "installed games on this PC" list for the launcher's library matching.
 */
export function getInstalledXboxGamePaths(): string[] {
  if (!isWindows()) return [];

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
