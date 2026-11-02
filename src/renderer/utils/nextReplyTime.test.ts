import { describe, expect, it } from 'vitest';
import { nextReplyTime } from './nextReplyTime';
import { removedReply, reviewAt, reviewReply, reviewThread } from './reviewPages.fixture';

describe('nextReplyTime', () => {
  it('uses the clock when it is ahead of the thread', () => {
    expect(
      nextReplyTime(reviewThread('a', [reviewReply('r', 5)]), Date.parse(reviewAt(30)))
    ).toBe(reviewAt(30));
  });

  it('dates a reply after the newest entry when the clock is behind', () => {
    expect(
      nextReplyTime(
        reviewThread('a', [reviewReply('r', 5), removedReply('gone')]),
        Date.parse(reviewAt(0))
      )
    ).toBe(new Date(Date.parse(reviewAt(5)) + 1).toISOString());
  });
});
