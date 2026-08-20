import fs from 'fs';
import path from 'path';
import { getSteamPath } from '../game-detector';
import { getPlatform } from './platform';
import { parseCompatToolName } from './vdf-parser';

/** Build installed on disk — not the host OS (Linux Steam titles are mostly Proton). */
export type GameBuildOs = 'windows' | 'linux' | 'macos';

const MAX_ENTRIES_PER_DIR = 2000;
const MAX_SUBDIRS_SCANNED = 60;

const ELF_MAGIC = '7f454c46';
const MACH_O_MAGICS = new Set([
  'feedface',
  'feedfacf',
  'cafebabe',
  'bebafeca',
  'cffaedfe',
  'cefaedfe',
]);

const WINDOWS_EXTENSIONS = new Set(['.exe']);
const LINUX_EXTENSIONS = new Set(['.sh', '.run', '.appimage']);
/** '' = no extension. */
const BINARY_EXTENSIONS = new Set(['', '.x86_64', '.x86', '.x64', '.bin', '.elf']);

interface BuildMarkers {
  windows: boolean;
  linux: boolean;
  macos: boolean;
}

async function readDirectory(dir: string): Promise<fs.Dirent[]> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    // Sorted so the cap below doesn't depend on readdir order.
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return entries.slice(0, MAX_ENTRIES_PER_DIR);
  } catch {
    return [];
  }
}

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

    // Symlinks report neither.
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

/** Only one marker is a verdict; anything else the caller resolves. */
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

  // Some stores nest the executable one level deep.
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

/** Live setting — updates the moment the user switches runtime. */
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
 * Strongest evidence first: files, Steam's compat tool, host OS. The Wine prefix
 * is skipped — it appears only on first launch, too late to be useful here.
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
