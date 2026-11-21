import { A } from '@mobily/ts-belt';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { readJsonFile } from '../utils/json-file';
import { isWindows } from '../utils/platform';

// EGL from 2026 (its EOS install helper) records each install as an .egi instead of a Data\Manifests .item; EGL 20.3 keeps the games in the Shared helper and only its own EOS components in the other
const INSTALL_HELPERS = ['EpicOnlineServicesShared', 'EpicOnlineServices'];

export const EPIC_INSTALLED_ITEMS_DIRS = INSTALL_HELPERS.map(
  (helper) => `C:\\ProgramData\\Epic\\${helper}\\InstallHelper\\InstalledItems`
);

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
function readEpicInstalledItems(itemsDir: string): EpicInstalledItem[] {
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

/** The installs of every InstalledItems folder, each install once. */
export function readAllEpicInstalledItems(
  itemsDirs: readonly string[]
): readonly EpicInstalledItem[] {
  return A.uniqBy(itemsDirs.flatMap(readEpicInstalledItems), (item) =>
    item.dir.toLowerCase()
  );
}

/** Where EGL on Windows records its installs as .egi items, whether or not it is installed. */
export function getEpicInstalledItemsPaths(): string[] {
  const programData = isWindows() ? process.env.PROGRAMDATA : undefined;
  return programData
    ? INSTALL_HELPERS.map((helper) =>
        path.join(programData, 'Epic', helper, 'InstallHelper', 'InstalledItems')
      )
    : [];
}

/** The .egi installs of this machine's EGL whose folder exists. */
export function getNativeEpicInstalledItems(): readonly EpicInstalledItem[] {
  return readAllEpicInstalledItems(getEpicInstalledItemsPaths()).filter((item) =>
    fs.existsSync(item.dir)
  );
}
