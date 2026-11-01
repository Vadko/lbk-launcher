import { describe, expect, it } from 'vitest';
import { parseSystemNotificationOptions } from './system-notification-options';

const THREAD = '0b6f3f0e-5c1a-4d2e-9f3b-2a1c4d5e6f70';
const ENTRY = '3d2c1b0a-9f8e-4d7c-8b6a-5f4e3d2c1b0a';

describe('parseSystemNotificationOptions', () => {
  it('keeps the game and the review entry a click leads to', () => {
    const options = {
      title: 'Game',
      body: 'text',
      target: { gameId: 'game-1', feedbackId: THREAD, entryId: ENTRY },
    };

    expect(parseSystemNotificationOptions(options)).toEqual(options);
  });

  it('leads to the game page when no review entry is named', () => {
    expect(
      parseSystemNotificationOptions({
        title: 'Game',
        body: 'text',
        target: { gameId: 'game-1' },
      })
    ).toEqual({ title: 'Game', body: 'text', target: { gameId: 'game-1' } });
  });

  it('shows a notification without a target', () => {
    expect(parseSystemNotificationOptions({ title: 'LBK', body: 'text' })).toEqual({
      title: 'LBK',
      body: 'text',
    });
  });

  it.each([
    ['no body', { title: 'LBK' }],
    ['no options', null],
    ['a malformed target', { title: 'LBK', body: 'text', target: { gameId: '' } }],
    [
      'a malformed thread id',
      { title: 'LBK', body: 'text', target: { gameId: 'game-1', feedbackId: 'x' } },
    ],
  ])('refuses a call with %s', (_case, options) => {
    expect(parseSystemNotificationOptions(options)).toBeNull();
  });
});
