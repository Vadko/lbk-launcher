import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { getSupabaseCredentials } from './supabase-credentials';

export interface BroadcastMessage<T = unknown> {
  event: string;
  type: 'broadcast';
  payload: T;
}

export interface BroadcastSubscription {
  topic: string;
  handlers: Array<{ event: string; handler: (message: BroadcastMessage) => void }>;
  onResubscribe?: () => void;
}

export class SupabaseRealtimeManager {
  private supabase: SupabaseClient | null = null;
  private channels: RealtimeChannel[] = [];
  private joinedTopics = new Set<string>();

  subscribe(subscriptions: Array<BroadcastSubscription | null | undefined>): void {
    if (this.channels.length > 0) {
      return;
    }
    const subs = subscriptions.filter((s): s is BroadcastSubscription => s != null);
    if (subs.length === 0) {
      return;
    }

    const { SUPABASE_URL, SUPABASE_ANON_KEY } = getSupabaseCredentials();
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    for (const sub of subs) {
      let channel = this.supabase.channel(sub.topic);
      for (const { event, handler } of sub.handlers) {
        channel = channel.on('broadcast', { event }, handler);
      }
      channel.subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.warn(`[SupabaseRealtime] ${sub.topic}: ${status}`);
          return;
        }
        console.log(`[SupabaseRealtime] Subscribed to ${sub.topic}`);
        if (this.joinedTopics.has(sub.topic)) {
          sub.onResubscribe?.();
        } else {
          this.joinedTopics.add(sub.topic);
        }
      });
      this.channels.push(channel);
    }
  }

  unsubscribe(): void {
    for (const channel of this.channels) {
      channel.unsubscribe();
    }
    this.channels = [];
    this.joinedTopics.clear();
    if (this.supabase) {
      this.supabase.realtime.disconnect();
      this.supabase.removeAllChannels();
      this.supabase = null;
    }
  }

  get isSubscribed(): boolean {
    return this.channels.length > 0;
  }
}
