import { useShallow } from 'zustand/react/shallow';
import type { ResourceKey, ResourceMap } from '@/shared/resources';
import { useResourcesStore } from '../store/useResourcesStore';
import { type Resource, resourceOf } from '../utils/resourceOf';

// A new object per read; useShallow re-renders only when the status or the value's identity changes
export function useResource<K extends ResourceKey>(key: K): Resource<ResourceMap[K]> {
  return useResourcesStore(useShallow((state) => resourceOf(state, key)));
}
