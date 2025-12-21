import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { Game } from '../../shared/types';
import { getMainWindow } from '../window';

const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

/**
 * Supabase Realtime Manager для підписки на зміни в таблиці games
 */
export class SupabaseRealtimeManager {
  private channel: RealtimeChannel | null = null;
  private supabase: SupabaseClient | null = null;
  private supabaseUrl: string;
  private supabaseKey: string;
  private retryCount = 0;
  private retryTimeout: NodeJS.Timeout | null = null;
  private onUpdateCallback: ((game: Game) => void) | null = null;
  private onDeleteCallback: ((gameId: string) => void) | null = null;

  constructor() {
    // Отримати credentials з env
    this.supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    this.supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Missing Supabase credentials in environment variables');
    }
  }

  /**
   * Розрахувати затримку з exponential backoff
   */
  private getRetryDelay(): number {
    const delay = Math.min(
      INITIAL_RETRY_DELAY_MS * Math.pow(2, this.retryCount),
      MAX_RETRY_DELAY_MS
    );
    // Додаємо jitter для уникнення thundering herd
    return delay + Math.random() * 1000;
  }

  /**
   * Спробувати перепідключитися
   */
  private scheduleRetry(): void {
    if (this.retryCount >= MAX_RETRY_ATTEMPTS) {
      console.error('[SupabaseRealtime] Max retry attempts reached, giving up');
      return;
    }

    const delay = this.getRetryDelay();
    console.log(
      `[SupabaseRealtime] Scheduling retry #${this.retryCount + 1} in ${Math.round(delay)}ms`
    );

    this.retryTimeout = setTimeout(() => {
      this.retryCount++;
      this.reconnect();
    }, delay);
  }

  /**
   * Перепідключитися до realtime
   */
  private reconnect(): void {
    if (!this.onUpdateCallback || !this.onDeleteCallback) {
      console.error('[SupabaseRealtime] Cannot reconnect: callbacks not set');
      return;
    }

    console.log('[SupabaseRealtime] Attempting to reconnect...');

    // Очистити попереднє підключення та клієнт
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }

    // Закрити старий Supabase client перед створенням нового
    if (this.supabase) {
      console.log('[SupabaseRealtime] Closing old Supabase client');
      this.supabase.realtime.disconnect();
      this.supabase.removeAllChannels();
      this.supabase = null;
    }

    // Створити нове підключення
    this.subscribeInternal(this.onUpdateCallback, this.onDeleteCallback);
  }

  /**
   * Підписатися на realtime оновлення games (публічний метод)
   */
  subscribe(onUpdate: (game: Game) => void, onDelete: (gameId: string) => void): void {
    // Зберігаємо callbacks для reconnect
    this.onUpdateCallback = onUpdate;
    this.onDeleteCallback = onDelete;

    this.subscribeInternal(onUpdate, onDelete);
  }

  /**
   * Внутрішній метод підписки
   */
  private subscribeInternal(
    onUpdate: (game: Game) => void,
    onDelete: (gameId: string) => void
  ): void {
    if (this.channel) {
      console.log('[SupabaseRealtime] Already subscribed, skipping');
      return;
    }

    console.log('[SupabaseRealtime] Subscribing to games table changes...');

    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);

    this.channel = this.supabase
      .channel('games-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'games',
        },
        (payload) => {
          console.log('[SupabaseRealtime] Game inserted:', payload);
          const newGame = payload.new as Game;

          // Тільки approved ігри додаємо
          if (!newGame.approved) {
            console.log(
              '[SupabaseRealtime] New game not approved, skipping:',
              newGame.name
            );
            return;
          }

          // Додати в локальну БД через callback
          onUpdate(newGame);

          // Відправити в renderer process
          const mainWindow = getMainWindow();
          if (mainWindow) {
            mainWindow.webContents.send('game-updated', newGame);
            console.log('[SupabaseRealtime] Sent new game to renderer:', newGame.name);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
        },
        (payload) => {
          console.log('[SupabaseRealtime] Game updated:', payload);
          const updatedGame = payload.new as Game;

          // Якщо гра більше не approved, видалити з локальної БД
          if (!updatedGame.approved) {
            console.log(
              '[SupabaseRealtime] Game unapproved, removing from local DB:',
              updatedGame.name
            );
            onDelete(updatedGame.id);

            // Відправити game-removed в renderer
            const mainWindow = getMainWindow();
            if (mainWindow) {
              mainWindow.webContents.send('game-removed', updatedGame.id);
            }
            return;
          }

          // Оновити локальну БД через callback
          onUpdate(updatedGame);

          // Відправити оновлення в renderer process
          const mainWindow = getMainWindow();
          if (mainWindow) {
            // Відправити game-updated для оновлення конкретної гри
            mainWindow.webContents.send('game-updated', updatedGame);

            console.log('[SupabaseRealtime] Sent update to renderer:', updatedGame.name);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'games',
        },
        (payload) => {
          console.log('[SupabaseRealtime] Game deleted:', payload);
          const deletedGameId = payload.old.id as string;

          // Видалити з локальної БД
          onDelete(deletedGameId);

          // Відправити game-removed в renderer
          const mainWindow = getMainWindow();
          if (mainWindow) {
            mainWindow.webContents.send('game-removed', deletedGameId);
            console.log(
              '[SupabaseRealtime] Sent game-removed to renderer:',
              deletedGameId
            );
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[SupabaseRealtime] Subscription status:', status);

        if (status === 'SUBSCRIBED') {
          // Успішно підключились - скидаємо лічильник спроб
          this.retryCount = 0;
          console.log('[SupabaseRealtime] Successfully connected to realtime');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[SupabaseRealtime] Connection error:', err);
          this.channel = null;
          this.scheduleRetry();
        } else if (status === 'CLOSED') {
          console.log('[SupabaseRealtime] Channel closed, attempting to reconnect...');
          this.channel = null;
          this.scheduleRetry();
        }
      });
  }

  /**
   * Відписатися від realtime оновлень
   */
  unsubscribe(): void {
    // Скасувати retry якщо запланований
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    if (this.channel) {
      console.log('[SupabaseRealtime] Unsubscribing from games table changes...');
      this.channel.unsubscribe();
      this.channel = null;
    }

    // Закрити Supabase client щоб звільнити WebSocket підключення
    if (this.supabase) {
      console.log('[SupabaseRealtime] Closing Supabase client');
      this.supabase.realtime.disconnect();
      this.supabase.removeAllChannels();
      this.supabase = null;
    }

    this.onUpdateCallback = null;
    this.onDeleteCallback = null;
    this.retryCount = 0;
  }

  /**
   * Скинути лічильник спроб (для ручного retry)
   */
  resetRetryCount(): void {
    this.retryCount = 0;
  }

  /**
   * Чи активна підписка
   */
  get isSubscribed(): boolean {
    return this.channel !== null;
  }
}
