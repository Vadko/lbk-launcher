import { F } from '@mobily/ts-belt';
import pLimit from 'p-limit';
import { z } from 'zod';
import { getDatabase } from './db/database';
import { functionsErrorStatus } from './db/functions-error';
import { GamesRepository } from './db/games-repository';
import { getSupabaseClient } from './db/supabase-client';
import { getMachineId, IS_E2E } from './tracking';
import { sendToRenderer } from './window';

interface MyLikeRow {
  liked: 0 | 1;
  server_liked: 0 | 1;
}

type LikeOutcome = { kind: 'confirmed'; likes: number } | { kind: 'rejected' | 'retry' };

const FLUSH_DELAY_MS = 400;
const RETRY_DELAY_MS = 60_000;
// Requests run one at a time, so a stalled one must not hold the queue for undici's ~5 minutes
const REQUEST_TIMEOUT_MS = 15_000;

const likeResponseSchema = z.object({ likes: z.number() });
const likedGamesResponseSchema = z.object({ gameIds: z.array(z.string()) });

const DELETE_SETTLED_SQL =
  'DELETE FROM my_likes WHERE game_id = ? AND liked = 0 AND server_liked = 0';

// The server count plus this machine's toggle the server has not seen yet
export function likesWithUnsentSql(count: string, gameId: string): string {
  return `MAX(${count} + COALESCE((SELECT liked - server_liked FROM my_likes WHERE game_id = ${gameId}), 0), 0)`;
}

const serial = pLimit(1);
const flushers = new Map<string, () => void>();
// A failed send retries every unsent like a minute after the last failure
const scheduleRetry = F.debounce(() => void flushPendingLikes(), RETRY_DELAY_MS);

function readRow(gameId: string): MyLikeRow | undefined {
  return getDatabase()
    .prepare('SELECT liked, server_liked FROM my_likes WHERE game_id = ?')
    .get(gameId) as MyLikeRow | undefined;
}

export function getLikedGameIds(): string[] {
  const rows = getDatabase()
    .prepare('SELECT game_id FROM my_likes WHERE liked = 1')
    .all() as { game_id: string }[];
  return rows.map((row) => row.game_id);
}

function notifyRenderer(gameIds: string[]): void {
  sendToRenderer('liked-games-changed', getLikedGameIds());
  const games = GamesRepository.getInstance().getGamesByIds(gameIds);
  if (games.length > 0) {
    sendToRenderer('game-counters-updated', games);
  }
}

// Always republishes, so a renderer that flipped its mirror ahead of a no-op or a failure is set back
export function setLike(gameId: string, liked: boolean): void {
  try {
    if ((readRow(gameId)?.liked === 1) !== liked) {
      queueLike(gameId, liked);
    }
  } finally {
    notifyRenderer([gameId]);
  }
}

function queueLike(gameId: string, liked: boolean): void {
  const db = getDatabase();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO my_likes (game_id, liked) VALUES (?, ?)
       ON CONFLICT(game_id) DO UPDATE SET liked = excluded.liked`
    ).run(gameId, liked ? 1 : 0);
    db.prepare('UPDATE games SET likes = MAX(likes + ?, 0) WHERE id = ?').run(
      liked ? 1 : -1,
      gameId
    );
  })();

  const flush =
    flushers.get(gameId) ?? F.debounce(() => void flushLike(gameId), FLUSH_DELAY_MS);
  flushers.set(gameId, flush);
  flush();
}

async function sendLike(gameId: string, liked: boolean): Promise<LikeOutcome> {
  if (IS_E2E) {
    return { kind: 'retry' };
  }
  const machineId = getMachineId();
  if (!machineId) {
    return { kind: 'rejected' };
  }
  const { data, error } = await getSupabaseClient().functions.invoke('track', {
    body: {
      type: 'like',
      gameId,
      userIdentifier: machineId,
      action: liked ? 'like' : 'unlike',
    },
    timeout: REQUEST_TIMEOUT_MS,
  });
  if (error) {
    const status = functionsErrorStatus(error);
    // 4xx is the server's final word (rate limit, unknown game); anything else may pass later
    return status !== undefined && status < 500
      ? { kind: 'rejected' }
      : { kind: 'retry' };
  }
  const parsed = likeResponseSchema.safeParse(data);
  return parsed.success
    ? { kind: 'confirmed', likes: parsed.data.likes }
    : { kind: 'retry' };
}

function flushLike(gameId: string): Promise<void> {
  return serial(() =>
    settleLike(gameId).catch((error: unknown) => {
      console.error(`[Likes] Failed to send the like for ${gameId}:`, error);
    })
  );
}

async function settleLike(gameId: string): Promise<void> {
  const sent = readRow(gameId);
  // Toggled back to what the server holds before the debounce fired: nothing to send
  if (!sent || sent.liked === sent.server_liked) {
    getDatabase().prepare(DELETE_SETTLED_SQL).run(gameId);
    return;
  }
  const outcome = await sendLike(gameId, sent.liked === 1);
  if (outcome.kind === 'retry') {
    scheduleRetry();
    return;
  }

  const db = getDatabase();
  db.transaction(() => {
    if (outcome.kind === 'confirmed') {
      db.prepare('UPDATE my_likes SET server_liked = ? WHERE game_id = ?').run(
        sent.liked,
        gameId
      );
      db.prepare(
        `UPDATE games SET likes = ${likesWithUnsentSql('?', '?')} WHERE id = ?`
      ).run(outcome.likes, gameId, gameId);
    } else {
      console.warn(
        `[Likes] Server rejected ${sent.liked ? 'like' : 'unlike'} for ${gameId}`
      );
      db.prepare(
        `UPDATE games
         SET likes = MAX(likes + COALESCE((SELECT server_liked - liked FROM my_likes WHERE game_id = ?), 0), 0)
         WHERE id = ?`
      ).run(gameId, gameId);
      db.prepare('UPDATE my_likes SET liked = server_liked WHERE game_id = ?').run(
        gameId
      );
    }
    db.prepare(DELETE_SETTLED_SQL).run(gameId);
  })();
  notifyRenderer([gameId]);
}

async function flushPendingLikes(): Promise<void> {
  const rows = getDatabase()
    .prepare('SELECT game_id FROM my_likes WHERE liked != server_liked')
    .all() as { game_id: string }[];
  await Promise.all(rows.map((row) => flushLike(row.game_id)));
}

async function fetchLikedGameIds(): Promise<string[] | null> {
  const machineId = getMachineId();
  if (IS_E2E || !machineId) {
    return null;
  }
  const { data, error } = await getSupabaseClient().functions.invoke('track', {
    body: { type: 'liked_games', userIdentifier: machineId },
    timeout: REQUEST_TIMEOUT_MS,
  });
  if (error) {
    console.error('[Likes] Failed to load liked games:', error);
    return null;
  }
  const parsed = likedGamesResponseSchema.safeParse(data);
  return parsed.success ? parsed.data.gameIds : null;
}

// The server is the source of truth (it survives reinstalls and cache clears), except for unsent changes
export async function syncLikes(): Promise<void> {
  await flushPendingLikes();
  // In the queue, so a like confirmed while the list is in flight is not replaced by the older list
  await serial(replaceWithServerLikes);
}

async function replaceWithServerLikes(): Promise<void> {
  const serverIds = await fetchLikedGameIds();
  if (!serverIds) {
    return;
  }
  const db = getDatabase();
  db.transaction(() => {
    db.prepare('DELETE FROM my_likes WHERE liked = server_liked').run();
    db.prepare('UPDATE my_likes SET server_liked = 0').run();
    const mark = db.prepare(
      `INSERT INTO my_likes (game_id, liked, server_liked) VALUES (?, 1, 1)
       ON CONFLICT(game_id) DO UPDATE SET server_liked = 1`
    );
    for (const gameId of serverIds) {
      mark.run(gameId);
    }
    db.prepare('DELETE FROM my_likes WHERE liked = 0 AND server_liked = 0').run();
  })();
  sendToRenderer('liked-games-changed', getLikedGameIds());
}
