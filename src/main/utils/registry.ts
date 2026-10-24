import { enumerateValuesSafe, type HKEY } from 'registry-js';

/** A string value of a registry key, or null when the key or value is missing. */
export function getRegistryString(hive: HKEY, key: string, name: string): string | null {
  const lower = name.toLowerCase();
  // The native result leaves holes for value types it doesn't convert (binary, multi-string, qword)
  const value = enumerateValuesSafe(hive, key).find(
    (entry) => entry?.name.toLowerCase() === lower
  );
  return typeof value?.data === 'string' ? value.data : null;
}

/** A DWORD value of a registry key, or null when the key or value is missing. */
export function getRegistryDword(hive: HKEY, key: string, name: string): number | null {
  const lower = name.toLowerCase();
  const value = enumerateValuesSafe(hive, key).find(
    (entry) => entry?.name.toLowerCase() === lower
  );
  return typeof value?.data === 'number' ? value.data : null;
}
