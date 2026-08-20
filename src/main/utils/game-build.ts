import fs from 'fs';
import path from 'path';
import { getSteamPath } from '../game-detector';
import { getPlatform } from './platform';
import { parseCompatToolName } from './vdf-parser';

/**
 * OS of the game build that is actually installed on disk.
 *
 * This is deliberately different from the host OS: on Linux (and especially on
 * Steam Deck) most Steam titles are installed as the *Windows* build and run
 * through Proton, so `process.platform === 'linux'` says nothing about which
 * files are sitting in the game folder.
 */
export type GameBuildOs = 'windows' | 'linux' | 'macos';

const MAX_ENTRIES_PER_DIR = 2000;
const MAX_SUBDIRS_SCANNED = 60;

/** First four bytes of a Linux executable. */
const ELF_MAGIC = '7f454c46';
/** First four bytes of a macOS executable (thin 32/64-bit and fat/universal). */
const MACH_O_MAGICS = new Set([
  'feedface',
  'feedfacf',
  'cafebabe',
  'bebafeca',
  'cffaedfe',
  'cefaedfe',
]);

/** Names that mark a build by themselves, without reading the file. */
const WINDOWS_EXTENSIONS = new Set(['.exe']);
const LINUX_EXTENSIONS = new Set(['.sh', '.run', '.appimage']);
/** Extensions that may hide a native binary ('' = no extension at all). */
const BINARY_EXTENSIONS = new Set(['', '.x86_64', '.x86', '.x64', '.bin', '.elf']);

interface BuildMarkers {
  windows: boolean;
  linux: boolean;
  macos: boolean;
}

async function readDirectory(dir: string): Promise<fs.Dirent[]> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    // readdir order is filesystem-dependent; sort so the cap below never makes
    // the verdict depend on hash order.
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return entries.slice(0, MAX_ENTRIES_PER_DIR);
  } catch {
    return [];
  }
}

/** Read the executable signature of a file, or null when unreadable. */
async function readMagic(filePath: string): Promise<string | null> {
  let handle: Awaited<ReturnType<typeof fs.promises.open>> | undefined;
  try {
    handle = await fs.promises.open(filePath, 'r');
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(4), 0, 4, 0);
    return bytesRead === 4 ? buffer.toString('hex') : null;
  } catch {
    return null;
  } finally {
    if (handle) {
      await handle.close().catch(() => undefined);
    }
  }
}

async function scanDirectory(dir: string, markers: BuildMarkers): Promise<void> {
  for (const entry of await readDirectory(dir)) {
    const fullPath = path.join(dir, entry.name);
    const lowerName = entry.name.toLowerCase();

    let isDirectory = entry.isDirectory();
    let isFile = entry.isFile();

    // Symlinks (and DT_UNKNOWN entries) report neither, so resolve them.
    if (!isDirectory && !isFile) {
      try {
        const stats = await fs.promises.stat(fullPath);
        isDirectory = stats.isDirectory();
        isFile = stats.isFile();
      } catch {
        continue;
      }
    }

    if (isDirectory) {
      if (lowerName.endsWith('.app')) {
        markers.macos = true;
      }
      continue;
    }

    if (!isFile) {
      continue;
    }

    const extension = path.extname(lowerName);

    if (WINDOWS_EXTENSIONS.has(extension)) {
      markers.windows = true;
      continue;
    }

    if (LINUX_EXTENSIONS.has(extension)) {
      markers.linux = true;
      continue;
    }

    // Anything left can still be a native binary — ask the file itself.
    if ((markers.linux && markers.macos) || !BINARY_EXTENSIONS.has(extension)) {
      continue;
    }

    const magic = await readMagic(fullPath);
    if (magic === ELF_MAGIC) {
      markers.linux = true;
    } else if (magic && MACH_O_MAGICS.has(magic)) {
      markers.macos = true;
    }
  }
}

/**
 * A verdict is only trustworthy when exactly one build is present. Folders that
 * ship several builds side by side (or none we recognise) are left to the
 * caller, which has stronger evidence available.
 */
function decide(markers: BuildMarkers): GameBuildOs | null {
  const found: GameBuildOs[] = [];
  if (markers.windows) {
    found.push('windows');
  }
  if (markers.linux) {
    found.push('linux');
  }
  if (markers.macos) {
    found.push('macos');
  }
  return found.length === 1 ? found[0] : null;
}

async function detectFromFiles(gamePath: string): Promise<GameBuildOs | null> {
  const markers: BuildMarkers = { windows: false, linux: false, macos: false };

  await scanDirectory(gamePath, markers);
  const topLevelVerdict = decide(markers);
  if (topLevelVerdict) {
    return topLevelVerdict;
  }

  // Some stores nest the executable one level deep (game/, bin/, Windows/...).
  let scanned = 0;
  for (const entry of await readDirectory(gamePath)) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }
    if (scanned >= MAX_SUBDIRS_SCANNED) {
      break;
    }
    scanned += 1;
    await scanDirectory(path.join(gamePath, entry.name), markers);
  }

  return decide(markers);
}

/** Map a Steam compatibility tool name onto the build it launches. */
function compatToolToBuildOs(toolName: string): GameBuildOs | null {
  const name = toolName.toLowerCase();
  if (!name) {
    return null;
  }
  if (name.includes('proton') || name.startsWith('wine')) {
    return 'windows';
  }
  if (name.includes('steamlinuxruntime')) {
    return 'linux';
  }
  return null;
}

/**
 * What Steam is configured to launch this app with *right now*.
 *
 * Preferred over the Wine prefix below: switching a game back to a native
 * runtime leaves the old prefix on disk, so `pfx` can outlive the setting that
 * created it, while this value is the live one.
 */
async function buildOsFromCompatTool(
  steamAppId: number | null | undefined
): Promise<GameBuildOs | null> {
  if (!steamAppId) {
    return null;
  }

  const steamPath = getSteamPath();
  if (!steamPath) {
    return null;
  }

  try {
    const configPath = path.join(steamPath, 'config', 'config.vdf');
    const toolName = parseCompatToolName(
      await fs.promises.readFile(configPath, 'utf-8'),
      steamAppId
    );
    return toolName === null ? null : compatToolToBuildOs(toolName);
  } catch {
    return null;
  }
}

/**
 * Work out which build of the game is installed at `gamePath`.
 *
 * Evidence is used strongest-first:
 *   1. the files on disk — they decide what we can patch at all, and are the
 *      only signal that is always present;
 *   2. the compatibility tool Steam is set to use for this app right now, which
 *      only breaks the tie when a folder ships several builds at once;
 *   3. the host OS, as a last resort.
 *
 * Steam's Wine prefix (`compatdata/<appId>/pfx`) is deliberately *not* used: it
 * is only created on the first launch, so it is missing exactly when a freshly
 * installed game is about to be patched.
 */
export async function resolveGameBuildOs(
  gamePath: string,
  steamAppId?: number | null
): Promise<GameBuildOs> {
  if (gamePath) {
    const fromFiles = await detectFromFiles(gamePath);
    if (fromFiles) {
      return fromFiles;
    }

    const fromCompatTool = await buildOsFromCompatTool(steamAppId);
    if (fromCompatTool) {
      console.log(
        `[GameBuild] Inconclusive folder; Steam compat tool → ${fromCompatTool}`
      );
      return fromCompatTool;
    }

    console.warn(
      '[GameBuild] Could not identify the installed build, falling back to host OS'
    );
  }

  const host = getPlatform();
  return host === 'unknown' ? 'windows' : host;
}
