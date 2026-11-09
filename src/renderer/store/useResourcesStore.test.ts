import { beforeEach, describe, expect, it } from 'vitest';
import type { ResourceKey, ResourceMap, ResourceUpdate } from '@/shared/resources';
import { useResourcesStore } from './useResourcesStore';

const liked = new Set(['a']);
const ratings = { teams: [], games: [] };
const store = () => useResourcesStore.getState();

beforeEach(() => {
  useResourcesStore.setState({
    values: { likedGameIds: liked, weeklyPicks: null },
    failed: new Set(['ratings']),
  });
});

describe('useResourcesStore apply', () => {
  it.each<[string, ResourceUpdate, Partial<ResourceMap>, ResourceKey[]]>([
    [
      'clears a key the update no longer names as failed',
      { values: { ratings }, failed: new Set() },
      { likedGameIds: liked, weeklyPicks: null, ratings },
      [],
    ],
    [
      'keeps the values the update does not carry',
      { values: { weeklyPicks: null }, failed: new Set(['ratings']) },
      { likedGameIds: liked, weeklyPicks: null },
      ['ratings'],
    ],
    [
      'keeps the last value of a key that failed',
      { values: {}, failed: new Set(['ratings', 'likedGameIds']) },
      { likedGameIds: liked, weeklyPicks: null },
      ['ratings', 'likedGameIds'],
    ],
    [
      'takes the failed keys of a snapshot as they are',
      {
        values: { likedGameIds: new Set(['b']), ratings },
        failed: new Set(['weeklyPicks']),
      },
      { likedGameIds: new Set(['b']), weeklyPicks: null, ratings },
      ['weeklyPicks'],
    ],
  ])('%s', (_label, update, values, failed) => {
    store().apply(update);

    expect(store().values).toEqual(values);
    expect([...store().failed]).toEqual(failed);
  });
});
