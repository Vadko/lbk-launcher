import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeFileAtomic } from './atomic-write';
import { DECKY_PLUGIN_DIR, detectDeckyPluginSync } from './decky';
import { millenniumPluginDataDir } from './millennium-plugin';
import { isWindows } from './platform';

type BridgePluginDataFile = 'bridge.json' | 'achievements.json';

const DATA_FILES: readonly BridgePluginDataFile[] = ['bridge.json', 'achievements.json'];

// Last payload per file, so a plugin installed later gets what the server and achievements already produced.
const pendingData = new Map<BridgePluginDataFile, string>();

function dataFileMode(): number | undefined {
  return isWindows() ? undefined : 0o600;
}

// Decky serves <homebrew>/data/<plugin dir>/ without a token, so nothing but these two files may go there.
function deckyDataDir(create: boolean): string | null {
  const decky = detectDeckyPluginSync();
  if (!decky?.plugin.installed || !decky.plugin.dir) {
    return null;
  }
  const dataRoot = path.join(decky.homebrewDir, 'data');
  const dir = path.join(dataRoot, path.basename(decky.plugin.dir));
  if (fs.existsSync(dir)) {
    return dir;
  }
  if (!create) {
    return null;
  }
  try {
    // A fresh Decky has no data/ until a plugin loads; the user-owned homebrew dir lets LBK create it first.
    fs.accessSync(
      fs.existsSync(dataRoot) ? dataRoot : decky.homebrewDir,
      fs.constants.W_OK
    );
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch {
    return null;
  }
}

function targets(create: boolean): string[] {
  return [millenniumPluginDataDir(), deckyDataDir(create)].filter(
    (dir): dir is string => dir !== null
  );
}

function writeTo(dir: string, file: BridgePluginDataFile, content: string): void {
  try {
    writeFileAtomic(path.join(dir, file), content, {
      mode: dataFileMode(),
      allowInPlace: true,
    });
  } catch (error) {
    console.warn(`[SteamBridge] Failed to write ${file} to ${dir}:`, error);
  }
}

export function writeBridgePluginData(file: BridgePluginDataFile, data: unknown): void {
  const content = JSON.stringify(data);
  pendingData.set(file, content);
  for (const dir of targets(true)) {
    writeTo(dir, file, content);
  }
}

export function deleteBridgePluginData(file: BridgePluginDataFile): void {
  pendingData.delete(file);
  for (const dir of targets(false)) {
    try {
      fs.rmSync(path.join(dir, file), { force: true });
    } catch (error) {
      console.warn(`[SteamBridge] Failed to delete ${file} from ${dir}:`, error);
    }
  }
}

// After a plugin appears or is reinstalled; rewrites only what differs.
export function resyncBridgePluginData(): void {
  for (const dir of targets(true)) {
    for (const [file, content] of pendingData) {
      let current: string | null = null;
      try {
        current = fs.readFileSync(path.join(dir, file), 'utf8');
      } catch {
        current = null;
      }
      if (current !== content) {
        writeTo(dir, file, content);
      }
    }
  }
}

// Decky keeps data/<dir> after the user uninstalls the plugin there.
export function removeOrphanDeckyPluginData(): void {
  const decky = detectDeckyPluginSync();
  if (!decky || decky.plugin.installed) {
    return;
  }
  const dir = path.join(decky.homebrewDir, 'data', DECKY_PLUGIN_DIR);
  for (const file of DATA_FILES) {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    try {
      fs.rmSync(filePath, { force: true });
      console.log(`[Decky] Removed ${filePath} left by an uninstalled plugin`);
    } catch (error) {
      console.warn(`[Decky] Failed to remove ${filePath}:`, error);
    }
  }
}
