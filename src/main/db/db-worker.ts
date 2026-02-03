/**
 * Worker Thread для SQLite операцій
 * Виконує важкі database операції без блокування main thread
 */
import { parentPort, workerData } from 'worker_threads';
import Database from 'better-sqlite3';
import type { Game } from '../../shared/types';
import { upsertGamesTransaction, deleteGameById } from './db-queries';

// Ініціалізація бази даних з переданим шляхом
let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    const dbPath = workerData?.dbPath;
    if (!dbPath) {
      throw new Error('Database path not provided to worker');
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

// Типи повідомлень
type WorkerMessage =
  | { type: 'upsertGames'; id: number; games: Game[] }
  | { type: 'deleteGame'; id: number; gameId: string }
  | { type: 'deleteGames'; id: number; gameIds: string[] };

type WorkerResponse =
  | { type: 'success'; id: number }
  | { type: 'error'; id: number; error: string };

// Обробка повідомлень від main thread
parentPort?.on('message', (message: WorkerMessage) => {
  try {
    const database = getDb();

    switch (message.type) {
      case 'upsertGames':
        upsertGamesTransaction(database, message.games);
        parentPort?.postMessage({ type: 'success', id: message.id } as WorkerResponse);
        break;

      case 'deleteGame':
        deleteGameById(database, message.gameId);
        parentPort?.postMessage({ type: 'success', id: message.id } as WorkerResponse);
        break;

      case 'deleteGames':
        for (const gameId of message.gameIds) {
          deleteGameById(database, gameId);
        }
        parentPort?.postMessage({ type: 'success', id: message.id } as WorkerResponse);
        break;

      default:
        parentPort?.postMessage({
          type: 'error',
          id: (message as { id: number }).id,
          error: 'Unknown message type',
        } as WorkerResponse);
    }
  } catch (error) {
    parentPort?.postMessage({
      type: 'error',
      id: message.id,
      error: error instanceof Error ? error.message : String(error),
    } as WorkerResponse);
  }
});

// Повідомити main thread що worker готовий
parentPort?.postMessage({ type: 'ready' });
