import type Database from 'better-sqlite3';
import type { Game } from '../../shared/types';
import { getDatabase } from './database';
import { GamesRepository } from './games-repository';
import { dbWorkerClient } from './db-worker-client';
import { createTimer } from '../utils/logger';

/**
 * Менеджер синхронізації між Supabase та локальною базою даних
 */
export class SyncManager {
  private db: Database.Database;
  private gamesRepo: GamesRepository;
  private isSyncing = false;

  constructor() {
    this.db = getDatabase();
    this.gamesRepo = new GamesRepository();
  }

  /**
   * Перевірити чи це перший запуск (база порожня)
   */
  private isFirstRun(): boolean {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM games');
    const result = stmt.get() as { count: number };
    return result.count === 0;
  }

  /**
   * Отримати last_sync_timestamp з метаданих
   */
  private getLastSyncTimestamp(): string | null {
    const stmt = this.db.prepare('SELECT value FROM sync_metadata WHERE key = ?');
    const result = stmt.get('last_sync_timestamp') as { value: string } | undefined;
    return result?.value || null;
  }

  /**
   * Зберегти last_sync_timestamp
   */
  private setLastSyncTimestamp(timestamp: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
    `);
    stmt.run('last_sync_timestamp', timestamp);
  }

  /**
   * Повний sync - завантажити всі ігри з Supabase та видалити видалені
   * Використовує Worker Thread для batch операцій щоб не блокувати main thread
   */
  async fullSync(
    fetchAllGames: () => Promise<Game[]>,
    fetchDeletedGameIds?: () => Promise<string[]>
  ): Promise<void> {
    if (this.isSyncing) {
      console.log('[SyncManager] Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;
    console.log('[SyncManager] Starting full sync...');

    try {
      // Ініціалізувати worker перед використанням
      const workerTimer = createTimer('Worker initialization');
      await dbWorkerClient.init();
      workerTimer.end();

      const fetchTimer = createTimer('Fetch games from Supabase');
      const games = await fetchAllGames();
      fetchTimer.end();
      console.log(`[SyncManager] Fetched ${games.length} games from Supabase`);

      // Batch upsert через Worker Thread (не блокує main thread)
      if (games.length > 0) {
        const upsertTimer = createTimer(`Upsert ${games.length} games via worker`);
        await dbWorkerClient.upsertGames(games);
        upsertTimer.end();
        console.log(`[SyncManager] Inserted/updated ${games.length} games via worker`);
      }

      // Видалити ігри, які є в deleted_games
      if (fetchDeletedGameIds) {
        const deletedIds = await fetchDeletedGameIds();
        if (deletedIds.length > 0) {
          console.log(
            `[SyncManager] Deleting ${deletedIds.length} games from deleted_games table`
          );
          const deleteTimer = createTimer(`Delete ${deletedIds.length} games`);
          await dbWorkerClient.deleteGames(deletedIds);
          deleteTimer.end();
        }
      }

      // Оновити last_sync_timestamp
      const now = new Date().toISOString();
      this.setLastSyncTimestamp(now);
      console.log('[SyncManager] Full sync completed successfully');
    } catch (error) {
      console.error('[SyncManager] Error during full sync:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Delta sync - завантажити тільки оновлені ігри та видалити видалені
   * Використовує Worker Thread для batch операцій щоб не блокувати main thread
   */
  async deltaSync(
    fetchUpdatedGames: (since: string) => Promise<Game[]>,
    fetchDeletedGameIds?: (since: string) => Promise<string[]>
  ): Promise<void> {
    if (this.isSyncing) {
      console.log('[SyncManager] Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;

    try {
      // Ініціалізувати worker перед використанням
      await dbWorkerClient.init();

      const lastSync = this.getLastSyncTimestamp();

      if (!lastSync) {
        console.log('[SyncManager] No last sync timestamp found, performing full sync');
        throw new Error('No last sync timestamp');
      }

      console.log(`[SyncManager] Starting delta sync from ${lastSync}...`);

      const updatedGames = await fetchUpdatedGames(lastSync);
      console.log(
        `[SyncManager] Fetched ${updatedGames.length} updated games from Supabase`
      );

      // Upsert через Worker Thread (не блокує main thread)
      if (updatedGames.length > 0) {
        await dbWorkerClient.upsertGames(updatedGames);
        console.log(`[SyncManager] Updated ${updatedGames.length} games via worker`);
      }

      // Видалити ігри, які були видалені на сервері
      if (fetchDeletedGameIds) {
        const deletedIds = await fetchDeletedGameIds(lastSync);
        if (deletedIds.length > 0) {
          console.log(
            `[SyncManager] Deleting ${deletedIds.length} games removed from server`
          );
          await dbWorkerClient.deleteGames(deletedIds);
        }
      }

      // Оновити last_sync_timestamp
      const now = new Date().toISOString();
      this.setLastSyncTimestamp(now);
      console.log('[SyncManager] Delta sync completed successfully');
    } catch (error) {
      console.error('[SyncManager] Error during delta sync:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Синхронізація при старті додатка
   * - Перший запуск: повний sync
   * - Наступні запуски: delta sync
   */
  async sync(
    fetchAllGames: () => Promise<Game[]>,
    fetchUpdatedGames: (since: string) => Promise<Game[]>,
    fetchDeletedGameIds?: (since?: string) => Promise<string[]>
  ): Promise<void> {
    if (this.isFirstRun()) {
      console.log('[SyncManager] First run detected, performing full sync');
      // Для fullSync передаємо функцію без параметра since
      await this.fullSync(
        fetchAllGames,
        fetchDeletedGameIds ? () => fetchDeletedGameIds() : undefined
      );
    } else {
      console.log('[SyncManager] Performing delta sync');
      try {
        await this.deltaSync(fetchUpdatedGames, fetchDeletedGameIds);
      } catch (error) {
        console.log('[SyncManager] Delta sync failed, falling back to full sync');
        await this.fullSync(
          fetchAllGames,
          fetchDeletedGameIds ? () => fetchDeletedGameIds() : undefined
        );
      }
    }
  }

  /**
   * Обробити realtime update
   */
  handleRealtimeUpdate(game: Game): void {
    console.log(
      `[SyncManager] Handling realtime update for game: ${game.name} (${game.id})`
    );
    this.gamesRepo.upsertGame(game);
  }

  /**
   * Обробити realtime видалення
   */
  handleRealtimeDelete(gameId: string): void {
    console.log(`[SyncManager] Handling realtime delete for game: ${gameId}`);
    this.gamesRepo.deleteGame(gameId);
  }

  /**
   * Чи синхронізація в процесі
   */
  get syncing(): boolean {
    return this.isSyncing;
  }
}
