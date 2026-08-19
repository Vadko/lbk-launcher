import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import type { InstallationStatus } from '../../shared/types';
import { isMacOS } from '../utils/platform';

const execFileAsync = promisify(execFile);

// Signing walks and hashes the whole bundle, which can be tens of gigabytes.
const EXEC_OPTIONS = { timeout: 10 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 };

/**
 * Whether a bundle-relative path is covered by the main executable's own code
 * directory. Only these break launching: the kernel validates the executable
 * (and the `Info.plist` hash it seals) on every exec, while everything under
 * `Contents/Resources` is sealed by `CodeResources`, which is consulted by
 * Gatekeeper assessment — not by exec.
 */
function sealedByExecutable(innerPath: string): boolean {
  return innerPath === 'Contents/Info.plist' || innerPath.startsWith('Contents/MacOS/');
}

/**
 * Map install-relative paths onto the `.app` bundles whose executable
 * signature they invalidate. Bundles touched only in `Contents/Resources` are
 * deliberately left out — re-signing those would trade a valid Developer ID
 * signature for an ad-hoc one to fix a problem they do not have.
 */
function findBrokenBundles(gameRoot: string, relativePaths: string[]): string[] {
  const bundles = new Set<string>();
  // The user may have picked the `.app` itself as the game folder, in which
  // case no path segment carries the `.app` suffix.
  const rootIsBundle = gameRoot.toLowerCase().endsWith('.app');

  for (const relativePath of relativePaths) {
    const segments = relativePath.split(path.sep).filter(Boolean);

    if (rootIsBundle) {
      if (sealedByExecutable(segments.join('/'))) {
        bundles.add(gameRoot);
      }
      continue;
    }

    const bundleIndex = segments.findIndex((s) => s.toLowerCase().endsWith('.app'));
    if (bundleIndex === -1) {
      continue;
    }
    if (sealedByExecutable(segments.slice(bundleIndex + 1).join('/'))) {
      bundles.add(path.join(gameRoot, ...segments.slice(0, bundleIndex + 1)));
    }
  }

  // A plain file may also end in `.app`; codesign would fail on it and, worse,
  // mask the real bundle.
  return [...bundles].filter((bundle) => {
    try {
      return fs.statSync(bundle).isDirectory();
    } catch {
      return false;
    }
  });
}

async function hasValidSignature(bundle: string): Promise<boolean> {
  try {
    await execFileAsync('codesign', ['--verify', bundle], EXEC_OPTIONS);
    return true;
  } catch {
    return false;
  }
}

/**
 * Make `.app` bundles self-consistent again after an install or uninstall
 * swapped code inside them.
 *
 * Replacing a bundle's executable or `Info.plist` leaves the pair mismatched,
 * and the kernel kills the process before its first instruction — no output,
 * no error the game can report (`EXC_CRASH (SIGKILL (Code Signature
 * Invalid))`, termination reason `CODESIGNING`). An ad-hoc signature
 * recomputes the hashes over what is actually on disk; it needs no
 * certificate, no admin rights, and `codesign` ships with macOS.
 *
 * Bundles that still verify are left untouched, so a translation that only
 * writes resources keeps its original Developer ID signature.
 *
 * Signing is deliberately not `--deep`: the kernel validates only the main
 * executable, nested code carries its own valid signatures, and descending
 * into them has been seen to fail outright — after `--force` already discarded
 * the old signature, leaving the bundle worse off than before.
 *
 * Returns false if any bundle that needed signing could not be signed, so the
 * caller can record the install as failed rather than report success for a
 * game that will not start.
 */
export async function resignMacBundles(
  gameRoot: string,
  relativePaths: string[],
  onStatus?: (status: InstallationStatus) => void
): Promise<boolean> {
  if (!isMacOS()) {
    return true;
  }

  const bundles = findBrokenBundles(gameRoot, relativePaths);
  if (bundles.length === 0) {
    return true;
  }

  let allSigned = true;

  for (const bundle of bundles) {
    const name = path.basename(bundle);

    if (await hasValidSignature(bundle)) {
      console.log(`[Codesign] Signature still valid, leaving as is: ${name}`);
      continue;
    }

    onStatus?.({ message: 'Підписання застосунку...', phase: 'install' });

    // 7-Zip restores Finder info and resource forks from archives authored on
    // macOS, and codesign refuses to sign a bundle carrying them ("resource
    // fork, Finder information, or similar detritus not allowed"). Clearing
    // every attribute also drops the download quarantine flag, which would
    // otherwise make Gatekeeper reject the now ad-hoc signature.
    try {
      await execFileAsync('xattr', ['-cr', bundle], EXEC_OPTIONS);
    } catch (error) {
      console.warn(`[Codesign] Could not clear extended attributes on ${name}:`, error);
    }

    try {
      // Preserving entitlements and flags keeps sandboxed and hardened-runtime
      // games working; the designated requirement is not preserved, since it
      // names a certificate an ad-hoc signature cannot satisfy.
      await execFileAsync(
        'codesign',
        ['--force', '--preserve-metadata=entitlements,flags', '--sign', '-', bundle],
        EXEC_OPTIONS
      );
      console.log(`[Codesign] Re-signed bundle: ${name}`);
    } catch (error) {
      allSigned = false;
      console.error(
        `[Codesign] Failed to re-sign ${name} — the game will be killed on launch:`,
        error
      );
    }
  }

  return allSigned;
}
