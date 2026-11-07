// A first read that failed ends the loading with the fallback; a later failure keeps the value already shown
export function settledResource<T, F>(
  value: T | undefined,
  failed: boolean,
  fallback: F
): T | F | undefined {
  return value === undefined && failed ? fallback : value;
}
