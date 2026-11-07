import { describe, expect, it, vi } from 'vitest';
import { createGamesBroadcastSubscription } from './games-realtime';

describe('createGamesBroadcastSubscription', () => {
  it('listens on the private topic, which only the server can send on', () => {
    expect(createGamesBroadcastSubscription(vi.fn(), vi.fn())).toMatchObject({
      topic: 'games-broadcast',
      private: true,
    });
  });
});
