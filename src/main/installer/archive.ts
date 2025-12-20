import fs from 'fs';
import { promisify } from 'util';
import { execSync } from 'child_process';
import { extractFull } from 'node-7z';
import { path7z as originalPath7z, path7zzs } from '7zip-bin-full';
import type { InstallationStatus } from '../../shared/types';

const mkdir = promisify(fs.mkdir);

// Fix for ASAR: replace .asar with .asar.unpacked for spawnable binaries
const bundled7z = originalPath7z.replace('app.asar', 'app.asar.unpacked');
const bundled7zzs = path7zzs.replace('app.asar', 'app.asar.unpacked');

/**
 * Check if system 7z is available (for Linux/Steam Deck compatibility)
 */
function getSystem7zPath(): string | null {
  if (process.platform !== 'linux') return null;

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
 * Priority: system 7z > static 7zzs > bundled 7zz
 */
function get7zPath(): string {
  // On Linux, prefer system 7z for better compatibility (especially Steam Deck)
  if (process.platform === 'linux') {
    const system7z = getSystem7zPath();
    if (system7z) {
      return system7z;
    }

    // Fallback to static binary (no dynamic library dependencies)
    if (fs.existsSync(bundled7zzs)) {
      console.log(`[7z] Using static bundled 7zzs: ${bundled7zzs}`);
      return bundled7zzs;
    }
  }

  // Default: use bundled 7zz
  console.log(`[7z] Using bundled 7z: ${bundled7z}`);
  return bundled7z;
}

const path7z = get7zPath();

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
