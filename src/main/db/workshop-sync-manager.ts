import type Database from 'better-sqlite3';
import type { WorkshopGame } from '../../shared/types';
import { getDatabase } from './database';
import { WorkshopGamesRepository } from './workshop-repository';

const LAST_SYNC_KEY = 'workshop_last_sync_timestamp';

/**
 * Менеджер синхронізації Steam Workshop перекладів між Supabase та локальною
 * базою даних. Простіший за SyncManager (games): немає worker thread (набагато
 * менший набір даних, ніж повний каталог games) і немає tombstone-логіки для
 * видалених елементів (Workshop-переклади ніколи не "встановлюються" цим
 * лаунчером, тож відкладати видалення не потрібно).
 */
export class WorkshopSyncManager {
  private static instance: WorkshopSyncManager | null = null;
  private db: Database.Database;
  private repo: WorkshopGamesRepository;
  private isSyncing = false;

  private constructor() {
    this.db = getDatabase();
    this.repo = WorkshopGamesRepository.getInstance();
  }

  static getInstance(): WorkshopSyncManager {
    if (!WorkshopSyncManager.instance) {
      WorkshopSyncManager.instance = new WorkshopSyncManager();
    }
    return WorkshopSyncManager.instance;
  }

  private isFirstRun(): boolean {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM workshop_games')
      .get() as { count: number };
    return result.count === 0;
  }

  private getLastSyncTimestamp(): string | null {
    const result = this.db
      .prepare('SELECT value FROM sync_metadata WHERE key = ?')
      .get(LAST_SYNC_KEY) as { value: string } | undefined;
    return result?.value || null;
  }

  private setLastSyncTimestamp(timestamp: string): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, datetime('now'))`
      )
      .run(LAST_SYNC_KEY, timestamp);
  }

  private deleteWorkshopGames(ids: string[]): void {
    if (ids.length === 0) {
      return;
    }
    const del = this.db.transaction((idsToDelete: string[]) => {
      const stmt = this.db.prepare('DELETE FROM workshop_games WHERE id = ?');
      for (const id of idsToDelete) {
        stmt.run(id);
      }
    });
    del(ids);
  }

  async fullSync(
    fetchAllWorkshopGames: () => Promise<WorkshopGame[]>,
    fetchDeletedWorkshopGameIds?: () => Promise<string[]>
  ): Promise<void> {
    if (this.isSyncing) {
      console.log('[WorkshopSyncManager] Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;
    console.log('[WorkshopSyncManager] Starting full sync...');

    try {
      const games = await fetchAllWorkshopGames();
      console.log(`[WorkshopSyncManager] Fetched ${games.length} workshop games`);

      if (games.length > 0) {
        this.repo.upsertWorkshopGames(games);
        console.log(`[WorkshopSyncManager] Upserted ${games.length} workshop games`);
      }

      if (fetchDeletedWorkshopGameIds) {
        const deletedIds = await fetchDeletedWorkshopGameIds();
        if (deletedIds.length > 0) {
          this.deleteWorkshopGames(deletedIds);
          console.log(
            `[WorkshopSyncManager] Deleted ${deletedIds.length} workshop games`
          );
        }
      }

      this.setLastSyncTimestamp(new Date().toISOString());
      console.log('[WorkshopSyncManager] Full sync completed successfully');
    } finally {
      this.isSyncing = false;
    }
  }

  async deltaSync(
    fetchUpdatedWorkshopGames: (since: string) => Promise<WorkshopGame[]>,
    fetchDeletedWorkshopGameIds?: (since: string) => Promise<string[]>
  ): Promise<void> {
    if (this.isSyncing) {
      console.log('[WorkshopSyncManager] Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;

    try {
      const lastSync = this.getLastSyncTimestamp();
      if (!lastSync) {
        throw new Error('No last sync timestamp for workshop games');
      }

      console.log(`[WorkshopSyncManager] Starting delta sync from ${lastSync}...`);
      const updatedGames = await fetchUpdatedWorkshopGames(lastSync);
      if (updatedGames.length > 0) {
        this.repo.upsertWorkshopGames(updatedGames);
        console.log(
          `[WorkshopSyncManager] Updated ${updatedGames.length} workshop games`
        );
      }

      if (fetchDeletedWorkshopGameIds) {
        const deletedIds = await fetchDeletedWorkshopGameIds(lastSync);
        if (deletedIds.length > 0) {
          this.deleteWorkshopGames(deletedIds);
          console.log(
            `[WorkshopSyncManager] Deleted ${deletedIds.length} workshop games removed from server`
          );
        }
      }

      this.setLastSyncTimestamp(new Date().toISOString());
      console.log('[WorkshopSyncManager] Delta sync completed successfully');
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Синхронізація при старті додатка. Перший запуск - повний sync, наступні -
   * delta sync (з fallback на повний, якщо delta не вдався).
   */
  async sync(
    fetchAllWorkshopGames: () => Promise<WorkshopGame[]>,
    fetchUpdatedWorkshopGames: (since: string) => Promise<WorkshopGame[]>,
    fetchDeletedWorkshopGameIds?: (since?: string) => Promise<string[]>
  ): Promise<void> {
    if (this.isFirstRun()) {
      console.log('[WorkshopSyncManager] First run detected, performing full sync');
      await this.fullSync(
        fetchAllWorkshopGames,
        fetchDeletedWorkshopGameIds ? () => fetchDeletedWorkshopGameIds() : undefined
      );
      return;
    }

    console.log('[WorkshopSyncManager] Performing delta sync');
    try {
      await this.deltaSync(fetchUpdatedWorkshopGames, fetchDeletedWorkshopGameIds);
    } catch (error) {
      console.log(
        '[WorkshopSyncManager] Delta sync failed, falling back to full sync',
        error
      );
      await this.fullSync(
        fetchAllWorkshopGames,
        fetchDeletedWorkshopGameIds ? () => fetchDeletedWorkshopGameIds() : undefined
      );
    }
  }
}
