import { useEffect } from 'react';
import type { ResourceKey, ResourceMap } from '@/shared/resources';
import { refreshResource } from '../store/resourcesBridge';
import type { Resource } from '../utils/resourceOf';
import { useResource } from './useResource';

// The last pushed value at once; each time enabled turns on, main reads the key again and pushes what it read
export function useRefreshedResource<K extends ResourceKey>(
  key: K,
  enabled: boolean
): Resource<ResourceMap[K]> {
  useEffect(() => {
    if (enabled) {
      refreshResource(key);
    }
  }, [key, enabled]);
  return useResource(key);
}
