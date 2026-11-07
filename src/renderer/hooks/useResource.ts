import type { ResourceKey, ResourceMap } from '@/shared/resources';
import { useResourcesStore } from '../store/useResourcesStore';

export function useResource<K extends ResourceKey>(key: K): ResourceMap[K] | undefined {
  return useResourcesStore((state) => state.values[key]);
}
