import { describe, expect, it } from 'vitest';
import { afterCursor, collectPages, keysetPages, latest, rewind } from './sync-cursor';

describe('latest', () => {
  it('compares instants, not strings, so mixed offsets and precisions order correctly', () => {
    expect(
      latest('2026-10-20T20:00:00.000Z', [
        '2026-10-20T22:30:00.123456+02:00',
        '2026-10-20T20:45:00+00:00',
      ])
    ).toBe('2026-10-20T20:45:00+00:00');
  });

  it('keeps the previous cursor when nothing newer arrived', () => {
    expect(latest('2026-10-20T20:00:00Z', [])).toBe('2026-10-20T20:00:00Z');
    expect(latest(null, [])).toBeNull();
  });
});

it('rewinds a cursor by one minute', () => {
  expect(rewind('2026-10-20T20:00:30+00:00')).toBe('2026-10-20T19:59:30.000Z');
});

it('quotes values so timestamps survive the or-filter syntax', () => {
  expect(afterCursor('updated_at', '2026-10-20T20:00:00.5+00:00', 'id', 'abc')).toBe(
    'updated_at.gt."2026-10-20T20:00:00.5+00:00",and(updated_at.eq."2026-10-20T20:00:00.5+00:00",id.gt."abc")'
  );
});

it('pages from the last row of each page until a page says it is the last', async () => {
  const rows = [1, 2, 3, 4, 5];
  const afters: (number | undefined)[] = [];
  const pages = keysetPages(
    (last: number | undefined) => {
      afters.push(last);
      return Promise.resolve(rows.filter((row) => row > (last ?? 0)).slice(0, 2));
    },
    (page) => page.length < 2
  );

  expect(await collectPages(pages)).toEqual(rows);
  expect(afters).toEqual([undefined, 2, 4]);
});
