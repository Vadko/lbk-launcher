import { describe, expect, it } from 'vitest';
import { editDeadline, editMinutesLeft } from './editDeadline';

const POSTED = '2026-11-01T07:40:00.000Z';

describe('editMinutesLeft', () => {
  it('rounds the time left up to whole minutes', () => {
    const deadline = editDeadline(POSTED);
    expect(editMinutesLeft(deadline, deadline - 30_000)).toBe(1);
    expect(editMinutesLeft(deadline, deadline - 14.5 * 60_000)).toBe(15);
  });

  it('never shows more than the window when the server clock is ahead', () => {
    const deadline = editDeadline(POSTED);
    expect(editMinutesLeft(deadline, Date.parse(POSTED) - 1_000)).toBe(15);
  });
});
