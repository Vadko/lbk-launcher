import { enumerateKeysSafe, HKEY } from 'registry-js';
import { getRegistryString } from '../utils/registry';

const UNINSTALL_ROOTS = [
  [
    HKEY.HKEY_LOCAL_MACHINE,
    'SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  ],
  [HKEY.HKEY_CURRENT_USER, 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'],
] as const;

export function listUninstallKeys() {
  return UNINSTALL_ROOTS.flatMap(([hive, root]) =>
    enumerateKeysSafe(hive, root).map((name) => {
      const key = `${root}\\${name}`;
      return { hive, key, id: `${hive}\\${key}` };
    })
  );
}

/**
 * Check for new Uninstall registry keys in HKLM and HKCU after installer run (Windows only).
 * If new key's DisplayName contains target words, print UninstallString.
 */
export function checkNewUninstallRegistryKeys(before: Set<string>): void {
  for (const entry of listUninstallKeys()) {
    if (before.has(entry.id)) {
      continue;
    }
    const displayName = getRegistryString(entry.hive, entry.key, 'DisplayName');
    const uninstallString = getRegistryString(entry.hive, entry.key, 'UninstallString');
    const name = displayName?.toLowerCase() ?? '';
    /* eslint-disable no-restricted-syntax -- words matched in installers' DisplayName, not UI text */
    if (
      name.includes('українізатор') ||
      name.includes('українською') ||
      name.includes('localization') ||
      name.includes('ukrainizator')
    ) {
      /* eslint-enable no-restricted-syntax */
      console.log('[Installer] New Uninstall registry key detected:', entry.id);
      console.log('[Installer]   DisplayName:', displayName ?? '(not found)');
      console.log('[Installer]   UninstallString:', uninstallString ?? '(not found)');
    }
  }
}
