import { app } from 'electron';
import { execSync } from 'child_process';
import fs from 'fs';
import { extractFull } from 'node-7z';
import path from 'path';
import { promisify } from 'util';
import type { InstallationStatus } from '../../shared/types';
import { isLinux, isMacOS, isWindows } from '../utils/platform';

const mkdir = promisify(fs.mkdir);

/**
 * Get architecture folder name for 7zip binaries
 */
function getArchFolder(): string {
  const arch = process.arch;
  return arch === 'x64' ? 'x64' : arch === 'arm64' ? 'arm64' : 'ia32';
}

/**
 * Get 7z binary path from extraResources or node_modules (dev)
 */
function getResourcesBased7zPath(): string {
  const arch = process.arch;
  const archFolder = getArchFolder();

  // In development, use node_modules directly
  if (!app.isPackaged) {
    const nodeModulesPath = path.join(app.getAppPath(), 'node_modules', '7zip-bin-full');
    if (isWindows()) {
      return path.join(nodeModulesPath, 'win', archFolder, '7z.exe');
    } else if (isMacOS()) {
      return path.join(nodeModulesPath, 'mac', arch, '7zz');
    } else {
      return path.join(nodeModulesPath, 'linux', archFolder, '7zz');
    }
  }

  // In production, use extraResources
  const resourcesPath = process.resourcesPath || path.join(app.getAppPath(), '..');

  if (isWindows()) {
    return path.join(resourcesPath, '7zip', 'win', archFolder, '7z.exe');
  } else if (isMacOS()) {
    return path.join(resourcesPath, '7zip', 'mac', arch, '7zz');
  } else {
    return path.join(resourcesPath, '7zip', 'linux', archFolder, '7zz');
  }
}

/**
 * Check if system 7z is available (for Linux/Steam Deck compatibility)
 */
function getSystem7zPath(): string | null {
  if (!isLinux()) return null;

  try {
    // Try common 7z command names
    for (const cmd of ['7zz', '7z', '7za']) {
      try {
        const result = execSync(`which ${cmd}`, {
          encoding: 'utf-8',
          timeout: 5000,
        }).trim();
        if (result) {
          console.log(`[7z] Found system 7z: ${result}`);
          return result;
        }
      } catch {
        // Command not found, try next
      }
    }
  } catch (error) {
    console.log('[7z] No system 7z found');
  }
  return null;
}

/**
 * Get the best available 7z binary path
 * Priority: system 7z (Linux) > extraResources 7z
 */
function get7zPath(): string {
  // On Linux, prefer system 7z for better compatibility (especially Steam Deck)
  if (isLinux()) {
    const system7z = getSystem7zPath();
    if (system7z) {
      return system7z;
    }
  }

  // Use 7z from extraResources (works for all builds including portable)
  const resourcesPath = getResourcesBased7zPath();
  if (fs.existsSync(resourcesPath)) {
    console.log(`[7z] Using resources 7z: ${resourcesPath}`);
    return resourcesPath;
  }

  console.error(`[7z] 7z binary not found at: ${resourcesPath}`);
  throw new Error(`7z binary not found: ${resourcesPath}`);
}

/**
 * Extract ZIP archive with support for all compression methods and UTF-8/Cyrillic filenames
 * Uses 7-Zip which supports LZMA, Deflate64, and all other compression methods
 */
export async function extractArchive(
  archivePath: string,
  extractPath: string,
  onStatus?: (status: InstallationStatus) => void
): Promise<void> {
  await mkdir(extractPath, { recursive: true });

  // Check if file exists and get its size
  if (!fs.existsSync(archivePath)) {
    throw new Error(`Archive file not found: ${archivePath}`);
  }

  const stats = fs.statSync(archivePath);
  console.log(`[Installer] Extracting archive: ${archivePath}`);
  console.log(`[Installer] Target directory: ${extractPath}`);
  console.log(`[Installer] Archive size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  const path7z = get7zPath();
  console.log(`[Installer] Using 7z: ${path7z}`);

  return new Promise<void>((resolve, reject) => {
    // Use 7-Zip for extraction (supports all compression methods including LZMA)
    const stream = extractFull(archivePath, extractPath, {
      $bin: path7z,
      $progress: true,
    });

    stream.on('data', (data: { file?: string }) => {
      console.log(`[Installer] Extracted: ${data.file || 'file'}`);
    });

    stream.on('progress', (progress: { percent?: number; fileCount?: number }) => {
      if (progress.percent !== undefined) {
        const percent = Math.round(progress.percent);
        console.log(`[Installer] Extraction progress: ${percent}%`);
        onStatus?.({
          message: `Розпакування файлів... ${percent}%`,
          progress: percent,
        });
      }
    });

    stream.on('end', () => {
      console.log(`[Installer] Extracted archive to: ${extractPath}`);
      onStatus?.({ message: 'Розпакування завершено' });
      resolve();
    });

    stream.on('error', (err: Error) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[Installer] extractArchive failed:`, {
        message: errorMessage,
        archivePath,
      });
      reject(new Error(`Помилка розпакування архіву: ${errorMessage}`));
    });
  });
}
