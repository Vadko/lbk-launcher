import type Database from 'better-sqlite3';
import type { Game } from '../../shared/types';
import { getLocallyInstalledGameIds } from '../installer/cache';
import { createTimer } from '../utils/logger';
import { getMainWindow } from '../window';
import { getDatabase } from './database';
import { upsertTagNames } from './db-queries';
import { dbWorkerClient } from './db-worker-client';
import { GamesRepository } from './games-repository';
import type { TagNameRow } from './supabase-sync-api';
import { getSyncMetadata, setSyncMetadata } from './sync-metadata';

const PENDING_DELETIONS_KEY = 'pending_game_deletions';
const TAG_NAMES_KEY = 'tag_names_synced_at';

/**
 * Notify the renderer that games were removed from the list (sidebar/main list).
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
 * Notify the renderer that a game was marked as tombstoned (removed from the
 * catalog but kept locally because it's installed). Used by GamePage for the banner.
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
 * Manages synchronization between Supabase and the local database
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
   * Get the singleton (used by IPC handlers and other consumers so a
   * reference doesn't need to be threaded through index.ts).
   */
  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  /**
   * Check whether this is the first run (database is empty)
   */
  private isFirstRun(): boolean {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM games');
    const result = stmt.get() as { count: number };
    return result.count === 0;
  }

  /**
   * Get last_sync_timestamp from metadata
   */
  private getLastSyncTimestamp(): string | null {
    const stmt = this.db.prepare('SELECT value FROM sync_metadata WHERE key = ?');
    const result = stmt.get('last_sync_timestamp') as { value: string } | undefined;
    return result?.value || null;
  }

  /**
   * Save last_sync_timestamp
   */
  private setLastSyncTimestamp(timestamp: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
    `);
    stmt.run('last_sync_timestamp', timestamp);
  }

  /**
   * Get the list of game IDs the server marked as deleted, but that are
   * currently installed for the user and are therefore kept in the local DB.
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
   * The single point of actual game deletion: deletes from SQLite via the worker
   * and notifies the renderer ('game-removed') so the sidebar list refreshes.
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
   * Split deletedIds into ones that can be deleted right away (game not installed)
   * and ones that must be kept until the localization is uninstalled.
   */
  private async splitDeletedIds(
    deletedIds: string[]
  ): Promise<{ safe: string[]; deferred: string[] }> {
    if (deletedIds.length === 0) {
      return { safe: [], deferred: [] };
    }
    const installedIds = await getLocallyInstalledGameIds();
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
   * Add IDs to the pending deletions list (uniquely).
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
   * Whether the game is marked as tombstoned (removed from the catalog but installed locally).
   */
  isGameTombstoned(gameId: string): boolean {
    return this.getPendingDeletions().includes(gameId);
  }

  /**
   * Walk pending deletions and delete from the local DB the ones that are no
   * longer installed (user uninstalled the translation or files were restored).
   * Called after a change in installation-cache.
   */
  async processPendingDeletions(): Promise<void> {
    const pending = this.getPendingDeletions();
    if (pending.length === 0) {
      return;
    }

    try {
      const installedIds = await getLocallyInstalledGameIds();
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
   * Full sync - load all games from Supabase and delete removed ones
   * Uses a Worker Thread for batch operations so the main thread isn't blocked
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
      // Initialize the worker before use
      const workerTimer = createTimer('Worker initialization');
      await dbWorkerClient.init();
      workerTimer.end();

      const fetchTimer = createTimer('Fetch games from Supabase');
      const games = await fetchAllGames();
      fetchTimer.end();
      console.log(`[SyncManager] Fetched ${games.length} games from Supabase`);

      // Batch upsert via the Worker Thread (doesn't block the main thread)
      if (games.length > 0) {
        const upsertTimer = createTimer(`Upsert ${games.length} games via worker`);
        await dbWorkerClient.upsertGames(games);
        upsertTimer.end();
        console.log(`[SyncManager] Inserted/updated ${games.length} games via worker`);
      }

      // Delete games present in deleted_games (except installed ones — those are deferred)
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

      // Update last_sync_timestamp
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
   * Delta sync - load only updated games and delete removed ones
   * Uses a Worker Thread for batch operations so the main thread isn't blocked
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
      // Initialize the worker before use
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

      // Upsert via the Worker Thread (doesn't block the main thread)
      if (updatedGames.length > 0) {
        await dbWorkerClient.upsertGames(updatedGames);
        console.log(`[SyncManager] Updated ${updatedGames.length} games via worker`);
      }

      // Delete games that were removed on the server (except installed ones)
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

      // Update last_sync_timestamp
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
   * Sync at app startup
   * - First run: full sync
   * - Subsequent runs: delta sync
   */
  async sync(
    fetchAllGames: () => Promise<Game[]>,
    fetchUpdatedGames: (since: string) => Promise<Game[]>,
    fetchDeletedGameIds?: (since?: string) => Promise<string[]>
  ): Promise<void> {
    if (this.isFirstRun()) {
      console.log('[SyncManager] First run detected, performing full sync');
      // For fullSync, pass a function without the since parameter
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

  async syncTagNames(
    fetchTagNames: (since?: string) => Promise<TagNameRow[]>
  ): Promise<void> {
    const rows = await fetchTagNames(getSyncMetadata(TAG_NAMES_KEY) ?? undefined);
    if (rows.length === 0) {
      return;
    }

    upsertTagNames(this.db, rows);
    setSyncMetadata(TAG_NAMES_KEY, rows[rows.length - 1].updated_at);
    console.log(`[SyncManager] Tag names updated: ${rows.length}`);
  }

  /**
   * Handle a realtime update
   */
  handleRealtimeUpdate(game: Game): void {
    console.log(
      `[SyncManager] Handling realtime update for game: ${game.name} (${game.id})`
    );
    this.gamesRepo.upsertGame(game);
  }

  /**
   * Handle a realtime deletion.
   * If the game is installed — keep it in the local DB until the user
   * uninstalls the localization (see processPendingDeletions).
   */
  async handleRealtimeDelete(gameId: string): Promise<void> {
    console.log(`[SyncManager] Handling realtime delete for game: ${gameId}`);
    const installedIds = await getLocallyInstalledGameIds();
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
   * Whether a sync is in progress
   */
  get syncing(): boolean {
    return this.isSyncing;
  }
}
