import fs from 'fs';

// A read-only schema makes Steam's overwrite fail ("failed to write schema to
// disk"), so the installed localization survives. 0o444/0o644 also toggles the
// read-only attribute on Windows. Best-effort on Windows (Steam runs as SYSTEM).

/** Lock a schema file read-only so Steam cannot overwrite it. */
export async function lockSchemaFile(filePath: string): Promise<void> {
  try {
    await fs.promises.chmod(filePath, 0o444);
  } catch (error) {
    console.warn(`[SchemaLock] Failed to lock ${filePath}:`, error);
  }
}

/** Unlock before any write/rename/unlink of a schema file. No-op if missing. */
export async function unlockSchemaFile(filePath: string): Promise<void> {
  try {
    if (!fs.existsSync(filePath)) return;
    await fs.promises.chmod(filePath, 0o644);
  } catch (error) {
    console.warn(`[SchemaLock] Failed to unlock ${filePath}:`, error);
  }
}
