/**
 * Клієнт для комунікації з DB Worker
 * Надає async API для виконання SQLite операцій у worker thread
 */
import { Worker } from 'worker_threads';
import path from 'path';
import { app } from 'electron';
import type { Game } from '../../shared/types';

type WorkerResponse =
  | { type: 'success'; id: number }
  | { type: 'error'; id: number; error: string }
  | { type: 'ready' };

class DbWorkerClient {
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingRequests = new Map<
    number,
    { resolve: () => void; reject: (error: Error) => void }
  >();
  private isReady = false;
  private readyPromise: Promise<void> | null = null;

  /**
   * Ініціалізувати worker
   */
  async init(): Promise<void> {
    if (this.worker) return;

    // Шлях до скомпільованого worker файлу
    const workerPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar', 'out', 'main', 'db-worker.js')
      : path.join(__dirname, 'db-worker.js');

    // Шлях до бази даних
    const dbPath = path.join(app.getPath('userData'), 'lbk.db');

    this.readyPromise = new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(workerPath, {
          workerData: { dbPath },
        });

        this.worker.on('message', (message: WorkerResponse) => {
          if (message.type === 'ready') {
            this.isReady = true;
            resolve();
            return;
          }

          const pending = this.pendingRequests.get(message.id);
          if (!pending) return;

          this.pendingRequests.delete(message.id);

          if (message.type === 'success') {
            pending.resolve();
          } else {
            pending.reject(new Error(message.error));
          }
        });

        this.worker.on('error', (error) => {
          console.error('[DbWorkerClient] Worker error:', error);
          reject(error);
        });

        this.worker.on('exit', (code) => {
          if (code !== 0) {
            console.error(`[DbWorkerClient] Worker exited with code ${code}`);
          }
          this.worker = null;
          this.isReady = false;
        });
      } catch (error) {
        reject(error);
      }
    });

    await this.readyPromise;
    console.log('[DbWorkerClient] Worker initialized');
  }

  /**
   * Дочекатись готовності worker
   */
  private async ensureReady(): Promise<void> {
    if (this.isReady) return;
    if (this.readyPromise) {
      await this.readyPromise;
    } else {
      await this.init();
    }
  }

  /**
   * Відправити повідомлення worker і дочекатись відповіді
   */
  private async sendMessage(message: object): Promise<void> {
    await this.ensureReady();

    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    const id = ++this.messageId;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker!.postMessage({ ...message, id });
    });
  }

  /**
   * Batch upsert ігор (async, не блокує main thread)
   */
  async upsertGames(games: Game[]): Promise<void> {
    await this.sendMessage({ type: 'upsertGames', games });
  }

  /**
   * Видалити гру
   */
  async deleteGame(gameId: string): Promise<void> {
    await this.sendMessage({ type: 'deleteGame', gameId });
  }

  /**
   * Видалити декілька ігор
   */
  async deleteGames(gameIds: string[]): Promise<void> {
    await this.sendMessage({ type: 'deleteGames', gameIds });
  }

  /**
   * Завершити worker
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
}

// Singleton instance
export const dbWorkerClient = new DbWorkerClient();
