import { describe, expect, it } from 'vitest';
import { gameLink } from './gameLink';
import { readReviewLink } from './readReviewLink';

const THREAD = '0b6f3f0e-5c1a-4d2e-9f3b-2a1c4d5e6f70';
const ENTRY = '3d2c1b0a-9f8e-4d7c-8b6a-5f4e3d2c1b0a';

describe('readReviewLink', () => {
  it('reads back what gameLink builds', () => {
    const link = gameLink({ gameId: 'game-1', feedbackId: THREAD, entryId: ENTRY });

    expect(readReviewLink(link.slice(link.indexOf('?')))).toEqual({
      focus: { feedbackId: THREAD, entryId: ENTRY },
    });
  });

  it('passes a thread id main will drop on to the request', () => {
    expect(readReviewLink(`?tab=reviews&thread=x&entry=${ENTRY}`)).toEqual({
      focus: { feedbackId: 'x', entryId: ENTRY },
    });
  });

  it.each([
    ['no ids', '?tab=reviews'],
    ['no entry', `?tab=reviews&thread=${THREAD}`],
    ['no thread', `?tab=reviews&entry=${ENTRY}`],
    ['an empty entry', `?tab=reviews&thread=${THREAD}&entry=`],
  ])('opens the tab without a focus for %s', (_case, search) => {
    expect(readReviewLink(search)).toEqual({ focus: null });
  });

  it.each([
    ['an empty search', ''],
    ['another tab', `?tab=info&thread=${THREAD}&entry=${ENTRY}`],
  ])('ignores %s', (_case, search) => {
    expect(readReviewLink(search)).toBeNull();
  });
});
