import { describe, expect, it } from 'vitest';
import type { ResourceKey, ResourceMap } from '@/shared/resources';
import { resourceOf } from './resourceOf';

const SHOWN = { title: null, games: [] };
const held = (values: Partial<ResourceMap>, failed: ResourceKey[] = []) => ({
  values,
  failed: new Set(failed),
});

describe('resourceOf', () => {
  it.each([
    ['still loading', held({}), { status: 'loading' }],
    ['a first read that failed', held({}, ['weeklyPicks']), { status: 'failed' }],
    ['a value', held({ weeklyPicks: SHOWN }), { status: 'ready', value: SHOWN }],
    [
      'a later read that failed',
      held({ weeklyPicks: SHOWN }, ['weeklyPicks']),
      { status: 'ready', value: SHOWN },
    ],
    ['a null value', held({ weeklyPicks: null }), { status: 'ready', value: null }],
    [
      'a null value whose next read failed',
      held({ weeklyPicks: null }, ['weeklyPicks']),
      { status: 'ready', value: null },
    ],
  ])('%s', (_label, state, expected) => {
    expect(resourceOf(state, 'weeklyPicks')).toEqual(expected);
  });
});
