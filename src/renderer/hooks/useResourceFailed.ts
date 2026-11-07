import type { ResourceKey } from '@/shared/resources';
import { useResourcesStore } from '../store/useResourcesStore';

// The last read failed; the value, if any, is the one before it
export function useResourceFailed(key: ResourceKey): boolean {
  return useResourcesStore((state) => state.failed.has(key));
}
