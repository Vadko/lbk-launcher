import { create } from 'zustand';
import type { ResourceKey, ResourceMap, ResourceUpdate } from '@/shared/resources';

interface ResourcesStore {
  // A key stays undefined until main sends its first value
  values: Partial<ResourceMap>;
  failed: ReadonlySet<ResourceKey>;
  apply: (update: ResourceUpdate) => void;
}

// Main owns every resource and sends only what changed, with every failed key each time
export const useResourcesStore = create<ResourcesStore>((set) => ({
  values: {},
  failed: new Set(),
  apply: ({ values, failed }) =>
    set((state) => ({ values: { ...state.values, ...values }, failed: new Set(failed) })),
}));
