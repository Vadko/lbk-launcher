import type { ResourceKey, ResourceMap } from '@/shared/resources';

// 'failed' is a first read that failed, with nothing to show; a failure after a value keeps it as 'ready'
export type Resource<T> =
  | { status: 'loading'; value?: undefined }
  | { status: 'ready'; value: T }
  | { status: 'failed'; value?: undefined };

const LOADING = { status: 'loading' } as const;
const FAILED = { status: 'failed' } as const;

interface Held {
  values: Partial<ResourceMap>;
  failed: ReadonlySet<ResourceKey>;
}

export function resourceOf<K extends ResourceKey>(
  held: Held,
  key: K
): Resource<ResourceMap[K]> {
  const value = held.values[key];
  if (value !== undefined) {
    return { status: 'ready', value };
  }
  return held.failed.has(key) ? FAILED : LOADING;
}
