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
 *   - Args 3 and 4 are start dir and launch options; the icon has no slot
 *     here and is set with `SetShortcutIcon`.
 *   - Exe and start dir are stored verbatim, so they go in quoted — Steam's
 *     own flow quotes them too, and an unquoted space splits the command at
 *     launch. The icon is a plain path Steam only reads, never executes, and
 *     it is stored unquoted there as well.
 *   - It is NOT idempotent: calling it twice with identical arguments creates
 *     two separate shortcuts, each with its own generated app id. So before
 *     adding we look ours up in the client itself — the local record of the
 *     app id is only a hint, and a data reset wipes it while Steam keeps the
 *     shortcut.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import { getCurrentSteamAccountId, getSteamGridPath } from '@/main/game-detector/steam';
import { isLinux, isMacOS } from '@/main/utils/platform';
import { ARTWORK_SLOTS, applyArtworkSlot } from '@/main/utils/steam-artwork';
import { ensureSteamBridge, type SteamBridge } from '@/main/utils/steam-bridge';
import {
  readSteamAccountValue,
  writeSteamAccountValue,
} from '@/main/utils/store-storage';
import { getIcon, resolveResource } from '@/main/utils/theme';
import { errorMessage } from '@/shared/errors';
import type { SteamLibraryFailure } from '@/shared/types';

// Pinned in the ops source as well; this copy is only for logs.
const SHORTCUT_NAME = 'LBK Launcher';
const LINUX_LAUNCH_OPTIONS = '--no-sandbox --disable-gpu-sandbox';
const RECORD_KEY = 'steam-self-shortcut';

function getStableExePath(): string {
  const exe =
    process.env.APPIMAGE || process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe');
  // macOS Steam rejects the binary inside a bundle (EResult 2) and takes only the .app.
  const bundleEnd = isMacOS() ? exe.lastIndexOf('.app/') : -1;
  return bundleEnd === -1 ? exe : exe.slice(0, bundleEnd + '.app'.length);
}

function getStableIconPath(): string {
  const source = getIcon('window');
  const target = path.join(app.getPath('userData'), 'steam-shortcut-icon.png');
  try {
    if (!fs.existsSync(target) || fs.statSync(target).size !== fs.statSync(source).size) {
      fs.copyFileSync(source, target);
    }
    return target;
  } catch (error) {
    console.warn('[SteamSelfShortcut] Icon copy failed, using bundled path:', error);
    return source;
  }
}

const SHORTCUT_ARTWORK_SLOTS = [
  ...ARTWORK_SLOTS,
  { key: 'capsule-vertical', assetType: 0, suffix: 'p' },
];

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

function quotedPath(value: string): string {
  return `"${value}"`;
}

async function applyArtwork(bridge: SteamBridge, appId: number): Promise<void> {
  const gridDir = getSteamGridPath();

  for (const slot of SHORTCUT_ARTWORK_SLOTS) {
    const asset = findArtworkFile(slot.key);
    if (!asset) {
      continue;
    }

    await applyArtworkSlot({
      appId,
      assetType: slot.assetType,
      suffix: slot.suffix,
      extension: asset.extension,
      bytes: fs.readFileSync(asset.path),
      gridDir,
      bridge,
      label: `self-shortcut/${slot.key}`,
    });
  }
}

type AddShortcutResult =
  | { ok: true }
  | { ok: false; reason: SteamLibraryFailure; error?: string };

/**
 * Idempotent: safe to call every time the user hits the Settings button.
 * Reuses the previously-created shortcut (if it's still there) instead of
 * adding a duplicate, and re-applies name/icon/artwork either way so a
 * partial prior failure gets completed on retry.
 */
export async function addLbkLauncherToSteamLibrary(): Promise<AddShortcutResult> {
  const bridge = await ensureSteamBridge();
  if (typeof bridge === 'string') {
    return { ok: false, reason: bridge };
  }

  const accountId = getCurrentSteamAccountId();
  if (!accountId) {
    return { ok: false, reason: 'failed', error: 'No logged-in Steam account found' };
  }

  const exePath = getStableExePath();
  const startDir = path.dirname(exePath);
  const iconPath = getStableIconPath();
  const launchOptions = isLinux() ? LINUX_LAUNCH_OPTIONS : '';

  try {
    const stored = readSteamAccountValue(RECORD_KEY, accountId);
    const recorded = typeof stored === 'number' ? stored : null;
    const found = await bridge.invoke('findShortcut', { recordedAppId: recorded });
    if (found === 'unknown') {
      return { ok: false, reason: 'library-unavailable' };
    }

    const appId =
      found ??
      (await bridge.invoke('addShortcut', {
        exe: quotedPath(exePath),
        startDir: quotedPath(startDir),
        launchOptions,
      }));
    writeSteamAccountValue(RECORD_KEY, accountId, appId);

    await bridge.invoke('updateShortcut', {
      appId,
      exe: quotedPath(exePath),
      startDir: quotedPath(startDir),
      icon: iconPath,
      launchOptions,
    });

    await applyArtwork(bridge, appId);

    console.log(
      `[SteamSelfShortcut] ${found === null ? 'Added' : 'Updated'} "${SHORTCUT_NAME}", app id ${appId}`
    );
    return { ok: true };
  } catch (error) {
    console.error('[SteamSelfShortcut] Failed:', error);
    return {
      ok: false,
      reason: 'failed',
      error: errorMessage(error, 'Bridge shortcut failed'),
    };
  }
}
