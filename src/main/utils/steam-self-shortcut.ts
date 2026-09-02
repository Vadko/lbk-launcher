/**
 * Add LBK Launcher itself as a non-Steam shortcut in the user's Steam
 * library — so it's launchable from Big Picture / Steam Deck Gaming Mode
 * with a controller, no alt-tabbing to the desktop needed.
 *
 * `SteamClient.Apps.AddShortcut` is the same call behind Steam's own "Add a
 * Non-Steam Game" — reverse-engineered quirks below, each verified live
 * against a throwaway test shortcut and cleaned up after:
 *
 *   - The `name` argument is ignored — Steam derives the display name from
 *     the exe's own metadata until it's overridden with a separate
 *     `SetShortcutName` call.
 *   - It is NOT idempotent: calling it twice with identical arguments creates
 *     two separate shortcuts, each with its own generated app id. So we keep
 *     a small local record of "our" app id and reuse/update it in place
 *     instead of re-adding on every click.
 *   - Artwork applies the same way as `steam-artwork.ts` — live via CEF when
 *     small enough, else written straight into `grid/` (multi-megabyte
 *     base64, e.g. the hero image, can blow the CDP eval timeout).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import { getSteamGridPath } from '@/main/game-detector/steam';
import { isCefDebuggingEnabledInSettings } from '@/main/utils/cef-flag-file';
import { evaluateInSharedJsContext, isCefAvailable } from '@/main/utils/steam-cef';
import { isSteamRunning } from '@/main/utils/steam-launcher';
import { getIcon } from '@/main/utils/theme';

const SHORTCUT_NAME = 'LBK Launcher';

interface ShortcutRecord {
  appId: number;
  exePath: string;
}

function getRecordPath(): string {
  return path.join(app.getPath('userData'), 'steam-self-shortcut.json');
}

function readRecord(): ShortcutRecord | null {
  try {
    const raw = fs.readFileSync(getRecordPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<ShortcutRecord>;
    return typeof parsed.appId === 'number' && typeof parsed.exePath === 'string'
      ? { appId: parsed.appId, exePath: parsed.exePath }
      : null;
  } catch {
    return null;
  }
}

function writeRecord(record: ShortcutRecord): void {
  try {
    fs.writeFileSync(getRecordPath(), JSON.stringify(record, null, 2), 'utf8');
  } catch (error) {
    console.warn('[SteamSelfShortcut] Failed to persist record:', error);
  }
}

function resolveResource(filename: string): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, filename)
    : path.join(app.getAppPath(), 'resources', filename);
}

/** Same three slots as `steam-artwork.ts`, plus the vertical capsule it skips (no source there — we have one here). */
const ARTWORK_SLOTS = [
  { key: 'header', assetType: 3, suffix: '' },
  { key: 'hero', assetType: 1, suffix: '_hero' },
  { key: 'logo', assetType: 2, suffix: '_logo' },
  { key: 'capsule-vertical', assetType: 0, suffix: 'p' },
] as const;

const ART_EXTENSIONS = ['png', 'jpg', 'jpeg'];

/** Find whichever extension the asset was actually shipped with. */
function findArtworkFile(key: string): { path: string; extension: string } | null {
  const dir = resolveResource('steam-shortcut');
  for (const extension of ART_EXTENSIONS) {
    const filePath = path.join(dir, `${key}.${extension}`);
    if (fs.existsSync(filePath)) {
      return { path: filePath, extension: extension === 'jpeg' ? 'jpg' : extension };
    }
  }
  return null;
}

function jsString(value: string): string {
  return JSON.stringify(value);
}

async function applyArtwork(appId: number): Promise<void> {
  const gridDir = getSteamGridPath();

  for (const slot of ARTWORK_SLOTS) {
    const asset = findArtworkFile(slot.key);
    if (!asset) {
      continue;
    }

    const bytes = fs.readFileSync(asset.path);

    try {
      await evaluateInSharedJsContext(
        `SteamClient.Apps.SetCustomArtworkForApp(${appId}, ${jsString(
          bytes.toString('base64')
        )}, ${jsString(asset.extension)}, ${slot.assetType})`
      );
      continue;
    } catch (error) {
      console.warn(
        `[SteamSelfShortcut] CEF artwork apply failed for ${slot.key}, writing file instead:`,
        error
      );
    }

    if (!gridDir) {
      continue;
    }
    try {
      fs.mkdirSync(gridDir, { recursive: true });
      const target = path.join(gridDir, `${appId}${slot.suffix}.${asset.extension}`);
      const tmp = `${target}.lbk.tmp`;
      fs.writeFileSync(tmp, bytes);
      fs.renameSync(tmp, target);
    } catch (error) {
      console.warn(`[SteamSelfShortcut] Failed to write ${slot.key} to grid/:`, error);
    }
  }
}

type AddShortcutResult =
  | { ok: true; appId: number; created: boolean }
  | {
      ok: false;
      reason: 'cef-unavailable' | 'steam-not-running' | 'failed';
      error?: string;
    };

/**
 * Idempotent: safe to call every time the user hits the Settings button.
 * Reuses the previously-created shortcut (if it's still there) instead of
 * adding a duplicate, and re-applies name/icon/artwork either way so a
 * partial prior failure gets completed on retry.
 */
export async function addLbkLauncherToSteamLibrary(): Promise<AddShortcutResult> {
  if (!(await isSteamRunning())) {
    return { ok: false, reason: 'steam-not-running' };
  }
  if (!(isCefDebuggingEnabledInSettings() && (await isCefAvailable()))) {
    return { ok: false, reason: 'cef-unavailable' };
  }

  const exePath = app.getPath('exe');
  const startDir = path.dirname(exePath);
  const iconPath = getIcon('window');

  try {
    const existing = readRecord();
    let appId: number | null = null;

    if (existing) {
      const stillThere = await evaluateInSharedJsContext<boolean>(
        `collectionStore.allGamesCollection.allApps.some((a) => a.appid === ${existing.appId})`
      );
      if (stillThere) {
        appId = existing.appId;
      }
    }

    let created = false;
    if (appId === null) {
      appId = await evaluateInSharedJsContext<number>(
        `SteamClient.Apps.AddShortcut(${jsString(SHORTCUT_NAME)}, ${jsString(exePath)}, '', ${jsString(iconPath)})`
      );
      created = true;
    }

    await evaluateInSharedJsContext(
      `(async () => {
        await SteamClient.Apps.SetShortcutName(${appId}, ${jsString(SHORTCUT_NAME)});
        await SteamClient.Apps.SetShortcutExe(${appId}, ${jsString(exePath)});
        await SteamClient.Apps.SetShortcutStartDir(${appId}, ${jsString(startDir)});
        await SteamClient.Apps.SetShortcutIcon(${appId}, ${jsString(iconPath)});
      })()`
    );

    await applyArtwork(appId);

    writeRecord({ appId, exePath });
    console.log(
      `[SteamSelfShortcut] ${created ? 'Added' : 'Updated'} "${SHORTCUT_NAME}", app id ${appId}`
    );
    return { ok: true, appId, created };
  } catch (error) {
    console.error('[SteamSelfShortcut] Failed:', error);
    return {
      ok: false,
      reason: 'failed',
      error: error instanceof Error ? error.message : 'CEF shortcut failed',
    };
  }
}
