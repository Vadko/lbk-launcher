import fs from 'fs';
import path from 'path';
import { getAllFiles } from './files';

const MAX_ANCHORS = 5;
const toPosix = (p: string): string => p.split(path.sep).join('/');
const segmentCount = (p: string): number => p.split('/').length;

export interface MacBundleResolution {
  target: string | null;
  appBundleFound: boolean;
  matchedInsideBundle: number;
}

export function findAppBundles(gameRoot: string): string[] {
  try {
    return fs
      .readdirSync(gameRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.toLowerCase().endsWith('.app'))
      .map((e) => path.join(gameRoot, e.name));
  } catch {
    return [];
  }
}

/**
 * On macOS, game data lives inside `<Game>.app/Contents/Resources/...`, but
 * archives use the root-relative Windows/Linux layout. Find the correct install
 * dir inside the bundle by locating where the archive's files already exist
 * (a translation replaces existing files); return it relative to `gameRoot`.
 * `target` is null when no confident match — caller must not fall back to a
 * silent root copy.
 */
export async function resolveMacBundleTarget(
  gameRoot: string,
  extractDir: string
): Promise<MacBundleResolution> {
  const appBundles = findAppBundles(gameRoot);
  const empty: MacBundleResolution = {
    target: null,
    appBundleFound: appBundles.length > 0,
    matchedInsideBundle: 0,
  };
  if (appBundles.length === 0) return empty;

  const archiveFiles = (await getAllFiles(extractDir)).map(toPosix);
  if (archiveFiles.length === 0) return empty;

  // Deepest paths first — distinctive anchors avoid matching generic filenames.
  const anchors = [...archiveFiles]
    .sort((a, b) => segmentCount(b) - segmentCount(a) || b.length - a.length)
    .slice(0, MAX_ANCHORS);

  let best: { baseAbs: string; score: number } | null = null;
  let bestTies = 0;

  for (const bundle of appBundles) {
    const bundleFiles = (await getAllFiles(bundle)).map(toPosix);
    // APFS дефолтно case-insensitive — зіставляємо в нижньому регістрі,
    // оригінальні шляхи зберігаємо для результату
    const bundleSetLower = new Set(bundleFiles.map((f) => f.toLowerCase()));

    // A bundle file ending with an anchor implies the install root is that
    // file's path minus the anchor.
    const candidateBases = new Set<string>();
    for (const anchor of anchors) {
      const anchorLower = anchor.toLowerCase();
      const suffix = `/${anchorLower}`;
      for (const bf of bundleFiles) {
        const bfLower = bf.toLowerCase();
        if (bfLower === anchorLower || bfLower.endsWith(suffix)) {
          candidateBases.add(bf.slice(0, bf.length - anchor.length).replace(/\/+$/, ''));
        }
      }
    }

    // Score each candidate by how many archive files already exist under it.
    for (const base of candidateBases) {
      const baseLower = base.toLowerCase();
      let score = 0;
      for (const rel of archiveFiles) {
        const relLower = rel.toLowerCase();
        if (bundleSetLower.has(base ? `${baseLower}/${relLower}` : relLower)) score++;
      }
      if (!best || score > best.score) {
        best = { baseAbs: base ? path.join(bundle, base) : bundle, score };
        bestTies = 1;
      } else if (score === best.score) {
        bestTies++;
      }
    }
  }

  if (!best) return empty;

  const confident =
    best.score >= Math.max(1, Math.ceil(archiveFiles.length / 2)) && bestTies === 1;
  return {
    target: confident ? path.relative(gameRoot, best.baseAbs) : null,
    appBundleFound: true,
    matchedInsideBundle: best.score,
  };
}
