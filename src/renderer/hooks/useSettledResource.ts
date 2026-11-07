import type { ResourceKey, ResourceMap } from '@/shared/resources';
import { settledResource } from '../utils/settledResource';
import { useResource } from './useResource';
import { useResourceFailed } from './useResourceFailed';

// undefined only while loading; pass a module-level fallback so its identity stays put
export function useSettledResource<K extends ResourceKey, F>(
  key: K,
  fallback: F
): ResourceMap[K] | F | undefined {
  const value = useResource(key);
  const failed = useResourceFailed(key);
  return settledResource(value, failed, fallback);
}
