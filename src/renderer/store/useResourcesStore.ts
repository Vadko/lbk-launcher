import { D } from '@mobily/ts-belt';
import { create } from 'zustand';
import type { ResourceKey, ResourceMap, ResourceUpdate } from '@/shared/resources';

interface ResourcesStore {
  // A key stays undefined until main sends its first value
  values: Partial<ResourceMap>;
  failed: ReadonlySet<ResourceKey>;
  apply: (update: ResourceUpdate) => void;
}

// Main owns every resource and sends only what changed; a failed read keeps the last value
export const useResourcesStore = create<ResourcesStore>((set) => ({
  values: {},
  failed: new Set(),
  apply: ({ values, failed }) =>
    set((state) => {
      const nextFailed = new Set(state.failed);
      for (const key of D.keys(values)) {
        nextFailed.delete(key);
      }
      for (const key of failed) {
        nextFailed.add(key);
      }
      return { values: { ...state.values, ...values }, failed: nextFailed };
    }),
}));
