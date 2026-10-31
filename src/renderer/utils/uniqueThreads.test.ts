import { describe, expect, it } from 'vitest';
import { uniqueThreads } from './uniqueThreads';

describe('uniqueThreads', () => {
  it('keeps every thread in page order', () => {
    expect(
      uniqueThreads([{ items: [{ id: 'a' }, { id: 'b' }] }, { items: [{ id: 'c' }] }])
    ).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  });

  it('keeps the focus copy on the first page when its own page brings it again', () => {
    const focus = { id: 'z', copy: 'focus' };

    expect(
      uniqueThreads([
        { items: [focus, { id: 'a', copy: 'page' }] },
        {
          items: [
            { id: 'b', copy: 'page' },
            { id: 'z', copy: 'page' },
          ],
        },
      ])
    ).toEqual([focus, { id: 'a', copy: 'page' }, { id: 'b', copy: 'page' }]);
  });

  it('reads no pages as no threads', () => {
    expect(uniqueThreads([])).toEqual([]);
  });
});
