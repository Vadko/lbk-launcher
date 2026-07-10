import type Database from 'better-sqlite3';
import type { Game } from '../../shared/types';
import { getAllInstalledGameIds } from '../installer/cache';
import { createTimer } from '../utils/logger';
import { getMainWindow } from '../window';
import { getDatabase } from './database';
import { dbWorkerClient } from './db-worker-client';
import { GamesRepository } from './games-repository';

const PENDING_DELETIONS_KEY = 'pending_game_deletions';

/**
 * Повідомити рендерер про видалення ігор зі списку (sidebar/головний список).
 */
function notifyGamesRemoved(gameIds: string[]): void {
  if (gameIds.length === 0) {
    return;
  }
  const mainWindow = getMainWindow();
  if (!mainWindow) {
    return;
  }
  for (const id of gameIds) {
    mainWindow.webContents.send('game-removed', id);
  }
}

/**
 * Повідомити рендерер що гра була позначена як tombstoned (видалена з каталогу,
 * але збережена локально бо встановлена). Використовується GamePage для banner.
 */
function notifyGamesTombstoned(gameIds: string[]): void {
  if (gameIds.length === 0) {
    return;
  }
  const mainWindow = getMainWindow();
  if (!mainWindow) {
    return;
  }
  for (const id of gameIds) {
    mainWindow.webContents.send('game-tombstoned', id);
  }
}

/**
 * Менеджер синхронізації між Supabase та локальною базою даних
 */
export class SyncManager {
  private static instance: SyncManager | null = null;
  private db: Database.Database;
  private gamesRepo: GamesRepository;
  private isSyncing = false;

  constructor() {
    this.db = getDatabase();
    this.gamesRepo = GamesRepository.getInstance();
  }

  /**
   * Отримати singleton (використовується IPC хендлерами та іншими споживачами,
   * щоб не передавати референс через index.ts).
   */
  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
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
   * Отримати список ID ігор, які сервер позначив видаленими, але які наразі
   * встановлені у користувача і тому збережені в локальній БД.
   */
  private getPendingDeletions(): string[] {
    const stmt = this.db.prepare('SELECT value FROM sync_metadata WHERE key = ?');
    const result = stmt.get(PENDING_DELETIONS_KEY) as { value: string } | undefined;
    if (!result?.value) {
      return [];
    }
    try {
      const parsed = JSON.parse(result.value);
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private setPendingDeletions(ids: string[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
    `);
    stmt.run(PENDING_DELETIONS_KEY, JSON.stringify(ids));
  }

  /**
   * Єдина точка реального видалення ігор: видаляє з SQLite через worker
   * і повідомляє рендерер ('game-removed'), щоб список у sidebar оновився.
   */
  private async actuallyDeleteGames(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await dbWorkerClient.init();
    await dbWorkerClient.deleteGames(ids);
    notifyGamesRemoved(ids);
  }

  /**
   * Розділити deletedIds на ті, які можна видалити одразу (гра не встановлена),
   * та ті, які треба зберегти до моменту видалення локалізації.
   */
  private async splitDeletedIds(
    deletedIds: string[]
  ): Promise<{ safe: string[]; deferred: string[] }> {
    if (deletedIds.length === 0) {
      return { safe: [], deferred: [] };
    }
    const installedIds = new Set(await getAllInstalledGameIds());
    const safe: string[] = [];
    const deferred: string[] = [];
    for (const id of deletedIds) {
      if (installedIds.has(id)) {
        deferred.push(id);
      } else {
        safe.push(id);
      }
    }
    return { safe, deferred };
  }

  /**
   * Додати ID до списку pending deletions (унікально).
   */
  private addPendingDeletions(ids: string[]): void {
    if (ids.length === 0) {
      return;
    }
    const existing = new Set(this.getPendingDeletions());
    const fresh: string[] = [];
    for (const id of ids) {
      if (!existing.has(id)) {
        existing.add(id);
        fresh.push(id);
      }
    }
    if (fresh.length === 0) {
      return;
    }
    this.setPendingDeletions([...existing]);
    notifyGamesTombstoned(fresh);
  }

  /**
   * Чи позначена гра як tombstoned (видалена з каталогу, але встановлена локально).
   */
  isGameTombstoned(gameId: string): boolean {
    return this.getPendingDeletions().includes(gameId);
  }

  /**
   * Пройтися по pending deletions і видалити з локальної БД ті, які
   * більше не встановлені (юзер видалив переклад або файли відновлено).
   * Викликається після зміни в installation-cache.
   */
  async processPendingDeletions(): Promise<void> {
    const pending = this.getPendingDeletions();
    if (pending.length === 0) {
      return;
    }

    try {
      const installedIds = new Set(await getAllInstalledGameIds());
      const stillInstalled: string[] = [];
      const readyToDelete: string[] = [];
      for (const id of pending) {
        if (installedIds.has(id)) {
          stillInstalled.push(id);
        } else {
          readyToDelete.push(id);
        }
      }

      if (readyToDelete.length > 0) {
        console.log(
          `[SyncManager] Processing ${readyToDelete.length} pending deletions (now uninstalled)`
        );
        await this.actuallyDeleteGames(readyToDelete);
      }

      if (readyToDelete.length > 0 || stillInstalled.length !== pending.length) {
        this.setPendingDeletions(stillInstalled);
      }
    } catch (error) {
      console.error('[SyncManager] Error processing pending deletions:', error);
    }
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

      // Видалити ігри, які є в deleted_games (крім встановлених — їх відкладаємо)
      if (fetchDeletedGameIds) {
        const deletedIds = await fetchDeletedGameIds();
        if (deletedIds.length > 0) {
          const { safe, deferred } = await this.splitDeletedIds(deletedIds);
          if (safe.length > 0) {
            console.log(
              `[SyncManager] Deleting ${safe.length} games from deleted_games table`
            );
            const deleteTimer = createTimer(`Delete ${safe.length} games`);
            await this.actuallyDeleteGames(safe);
            deleteTimer.end();
          }
          if (deferred.length > 0) {
            console.log(
              `[SyncManager] Deferring deletion of ${deferred.length} installed games`
            );
            this.addPendingDeletions(deferred);
          }
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

      // Видалити ігри, які були видалені на сервері (крім встановлених)
      if (fetchDeletedGameIds) {
        const deletedIds = await fetchDeletedGameIds(lastSync);
        if (deletedIds.length > 0) {
          const { safe, deferred } = await this.splitDeletedIds(deletedIds);
          if (safe.length > 0) {
            console.log(
              `[SyncManager] Deleting ${safe.length} games removed from server`
            );
            await this.actuallyDeleteGames(safe);
          }
          if (deferred.length > 0) {
            console.log(
              `[SyncManager] Deferring deletion of ${deferred.length} installed games`
            );
            this.addPendingDeletions(deferred);
          }
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
   * Обробити realtime видалення.
   * Якщо гра встановлена — зберегти її у локальній БД до моменту, коли
   * користувач видалить локалізацію (див. processPendingDeletions).
   */
  async handleRealtimeDelete(gameId: string): Promise<void> {
    console.log(`[SyncManager] Handling realtime delete for game: ${gameId}`);
    const installedIds = new Set(await getAllInstalledGameIds());
    if (installedIds.has(gameId)) {
      console.log(
        `[SyncManager] Game ${gameId} is installed — deferring deletion until uninstall`
      );
      this.addPendingDeletions([gameId]);
      return;
    }
    await this.actuallyDeleteGames([gameId]);
  }

  /**
   * Чи синхронізація в процесі
   */
  get syncing(): boolean {
    return this.isSyncing;
  }
}
