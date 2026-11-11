import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { readJsonFile } from '../utils/json-file';
import { isWindows } from '../utils/platform';

// EGL from 2026 (its EOS install helper) records each install here instead of a Data\Manifests .item
export const EPIC_INSTALLED_ITEMS_DIR =
  'C:\\ProgramData\\Epic\\EpicOnlineServices\\InstallHelper\\InstalledItems';

const installedItemSchema = z.object({
  v4: z.object({
    installationId: z.string(),
    state: z.string(),
    dir: z.string().min(1),
    sandboxId: z.string().optional(),
    itemId: z.string().optional(),
    artifactId: z.string().optional(),
  }),
});

const GAME_INSTALLATION_ID = /^[0-9a-f]{32}$/i;

export interface EpicInstalledItem {
  /** The game folder as EGL wrote it, a Windows path */
  dir: string;
  /** namespace:itemId:artifactId, the id EGL's launch link takes */
  appId: string | null;
}

/** The finished installs of one InstalledItems folder. */
export function readEpicInstalledItems(itemsDir: string): EpicInstalledItem[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(itemsDir).filter((name) => name.endsWith('.egi'));
  } catch {
    return [];
  }
  return files.flatMap((name) => {
    const item = readJsonFile(path.join(itemsDir, name), installedItemSchema)?.v4;
    // EGL's own EOS components (overlay, service, support) are items too, named so; a game's id is a GUID
    if (item?.state !== 'Installed' || !GAME_INSTALLATION_ID.test(item.installationId)) {
      return [];
    }
    const { sandboxId, itemId, artifactId } = item;
    return [
      {
        dir: item.dir,
        appId:
          sandboxId && itemId && artifactId
            ? `${sandboxId}:${itemId}:${artifactId}`
            : null,
      },
    ];
  });
}

/** Where EGL on Windows records its installs as .egi items, whether or not it is installed. */
export function getEpicInstalledItemsPath(): string | null {
  const programData = isWindows() ? process.env.PROGRAMDATA : undefined;
  return programData
    ? path.join(
        programData,
        'Epic',
        'EpicOnlineServices',
        'InstallHelper',
        'InstalledItems'
      )
    : null;
}

/** The .egi installs of this machine's EGL whose folder exists. */
export function getNativeEpicInstalledItems(): EpicInstalledItem[] {
  const dir = getEpicInstalledItemsPath();
  return dir ? readEpicInstalledItems(dir).filter((item) => fs.existsSync(item.dir)) : [];
}
