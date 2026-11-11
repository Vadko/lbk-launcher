import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { readJsonFile } from '../utils/json-file';

// EGL from 2026 (its EOS install helper) records each install here instead of a Data\Manifests .item
export const EPIC_INSTALLED_ITEMS_DIR =
  'C:\\ProgramData\\Epic\\EpicOnlineServices\\InstallHelper\\InstalledItems';

const installedItemSchema = z.object({
  v4: z.object({
    state: z.string(),
    dir: z.string().min(1),
    sandboxId: z.string().optional(),
    itemId: z.string().optional(),
    artifactId: z.string().optional(),
  }),
});

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
    if (item?.state !== 'Installed') {
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
