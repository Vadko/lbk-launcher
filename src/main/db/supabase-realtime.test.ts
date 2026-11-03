import { beforeEach, describe, expect, it, vi } from 'vitest';

type Status = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

const state = vi.hoisted(() => ({
  joins: [] as Array<(status: Status) => void>,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    channel: () => {
      const channel = {
        on: () => channel,
        subscribe: (callback: (status: Status) => void) => {
          state.joins.push(callback);
          return channel;
        },
        unsubscribe: vi.fn(),
      };
      return channel;
    },
    realtime: { disconnect: vi.fn() },
    removeAllChannels: vi.fn(),
  }),
}));
vi.mock('@/main/db/supabase-credentials', () => ({
  getSupabaseCredentials: () => ({ SUPABASE_URL: 'https://x', SUPABASE_ANON_KEY: 'k' }),
}));

const { SupabaseRealtimeManager } = await import('./supabase-realtime');

beforeEach(() => {
  state.joins = [];
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('SupabaseRealtimeManager', () => {
  it('calls onSubscribed on the first join and every rejoin, never on a failure', () => {
    const onSubscribed = vi.fn();
    const manager = new SupabaseRealtimeManager();
    manager.subscribe([{ topic: 't', handlers: [], onSubscribed }]);
    const [join] = state.joins;

    for (const status of [
      'SUBSCRIBED',
      'CHANNEL_ERROR',
      'TIMED_OUT',
      'SUBSCRIBED',
      'CLOSED',
      'SUBSCRIBED',
    ] as const) {
      join?.(status);
    }

    expect(onSubscribed).toHaveBeenCalledTimes(3);
    manager.unsubscribe();
  });
});
