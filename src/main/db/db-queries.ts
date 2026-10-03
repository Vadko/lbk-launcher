/**
 * Shared SQL queries and utilities for working with the database
 * Used in games-repository.ts and db-worker.ts
 */
import type Database from 'better-sqlite3';
import { IS_ADMIN_BUILD } from '../../shared/admin-mode';
import { generateSearchableString, withStrippedVariant } from '../../shared/search-utils';
import type { Game, Database as SupabaseDatabase } from '../../shared/types';

/**
 * Visible games: hidden ones are only shown if unlocked by the user.
 * In the admin build (`VITE_ADMIN_MODE=true`), hidden translations are always visible.
 */
export const VISIBLE_GAMES_SQL = IS_ADMIN_BUILD
  ? 'approved = 1'
  : 'approved = 1 AND (hide = 0 OR user_unlocked = 1)';

export function parseTagIds(json: unknown): number[] | null {
  if (typeof json !== 'string') {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((t): t is number => typeof t === 'number')
      : null;
  } catch {
    return null;
  }
}

/**
 * Fields that are not stored in the local DB
 */
type ExcludedLocalFields =
  | 'archive_file_list'
  | 'voice_archive_file_list'
  | 'achievements_archive_file_list'
  | 'epic_archive_file_list'
  | 'gog_archive_file_list'
  | 'xbox_archive_file_list'
  | 'uplay_archive_file_list'
  | 'ea_archive_file_list'
  | 'steam_linux_archive_file_list'
  | 'steam_mac_archive_file_list'
  | 'name_fts' // Generated column in Supabase for FTS
  | 'last_download_milestone' // Admin-only milestone watermark, not synced locally
  | 'last_subscriber_milestone';

/**
 * Parameters for inserting a game into the DB (local SQLite)
 * Mapped type based on Supabase Database types, but with conversions for SQLite:
 * - boolean -> number (0/1)
 * - arrays/objects -> JSON string
 * - Excluded file_list fields
 */
type GameInsertParams = {
  [K in keyof Omit<
    SupabaseDatabase['public']['Tables']['games']['Row'],
    ExcludedLocalFields
  >]: K extends 'approved' | 'is_adult' | 'license_only' | 'hide'
    ? number // boolean is converted to 0/1 for SQLite
    : K extends 'ai'
      ? string | null // ai is now a text field: 'edited' | 'non-edited' | null
      : K extends 'platforms' | 'install_paths' | 'screenshots' | 'steam_tag_ids'
        ? string | null // JSON.stringify for SQLite
        : SupabaseDatabase['public']['Tables']['games']['Row'][K];
} & {
  // Local-only field for search (not in Supabase)
  name_search: string;
};

/**
 * Convert a Game into parameters for inserting into the DB
 */
function gameToInsertParams(game: Game): GameInsertParams {
  return {
    id: game.id,
    kind: game.kind ?? 'regular',
    workshop_id: game.workshop_id ?? null,
    approved: game.approved ? 1 : 0,
    approved_at: game.approved_at ?? null,
    approved_by: game.approved_by ?? null,
    archive_hash: game.archive_hash ?? null,
    archive_path: game.archive_path ?? null,
    archive_size: game.archive_size ?? null,
    banner_path: game.banner_path ?? null,
    capsule_path: game.capsule_path ?? null,
    created_at: game.created_at ?? null,
    created_by: game.created_by ?? null,
    description: game.description ?? null,
    discord: game.discord ?? null,
    downloads: game.downloads ?? null,
    subscriptions: game.subscriptions ?? null,
    editing_progress: game.editing_progress ?? null,
    fonts_progress: game.fonts_progress ?? null,
    fundraising_current: game.fundraising_current ?? null,
    fundraising_goal: game.fundraising_goal ?? null,
    game_description: game.game_description ?? null,
    install_paths: game.install_paths ? JSON.stringify(game.install_paths) : null,
    installation_file_linux_path: game.installation_file_linux_path ?? null,
    installation_file_windows_path: game.installation_file_windows_path ?? null,
    is_adult: game.is_adult ? 1 : 0,
    license_only: game.license_only ? 1 : 0,
    logo_path: game.logo_path ?? null,
    name: game.name,
    name_search: generateSearchableString(game.name),
    platforms: JSON.stringify(game.platforms),
    project_id: game.project_id ?? null,
    screenshots: game.screenshots ? JSON.stringify(game.screenshots) : null,
    slug: game.slug ?? null,
    status: game.status ?? null,
    support_url: game.support_url ?? null,
    team: game.team ?? null,
    telegram: game.telegram ?? null,
    textures_progress: game.textures_progress ?? null,
    thumbnail_path: game.thumbnail_path ?? null,
    translation_progress: game.translation_progress ?? null,
    translation_updated_at: game.translation_updated_at ?? null,
    twitter: game.twitter ?? null,
    updated_at: game.updated_at ?? null,
    version: game.version ?? null,
    video_url: game.video_url ?? null,
    voice_archive_hash: game.voice_archive_hash ?? null,
    voice_archive_path: game.voice_archive_path ?? null,
    voice_archive_size: game.voice_archive_size ?? null,
    voice_progress: game.voice_progress ?? null,
    achievements_archive_hash: game.achievements_archive_hash ?? null,
    achievements_archive_path: game.achievements_archive_path ?? null,
    achievements_archive_size: game.achievements_archive_size ?? null,
    achievements_third_party: game.achievements_third_party ?? null,
    additional_path: game.additional_path ?? null,
    epic_archive_hash: game.epic_archive_hash ?? null,
    epic_archive_path: game.epic_archive_path ?? null,
    epic_archive_size: game.epic_archive_size ?? null,
    gog_archive_hash: game.gog_archive_hash ?? null,
    gog_archive_path: game.gog_archive_path ?? null,
    gog_archive_size: game.gog_archive_size ?? null,
    xbox_archive_hash: game.xbox_archive_hash ?? null,
    xbox_archive_path: game.xbox_archive_path ?? null,
    xbox_archive_size: game.xbox_archive_size ?? null,
    uplay_archive_hash: game.uplay_archive_hash ?? null,
    uplay_archive_path: game.uplay_archive_path ?? null,
    uplay_archive_size: game.uplay_archive_size ?? null,
    ea_archive_hash: game.ea_archive_hash ?? null,
    ea_archive_path: game.ea_archive_path ?? null,
    ea_archive_size: game.ea_archive_size ?? null,
    steam_linux_archive_hash: game.steam_linux_archive_hash ?? null,
    steam_linux_archive_path: game.steam_linux_archive_path ?? null,
    steam_linux_archive_size: game.steam_linux_archive_size ?? null,
    steam_mac_archive_hash: game.steam_mac_archive_hash ?? null,
    steam_mac_archive_path: game.steam_mac_archive_path ?? null,
    steam_mac_archive_size: game.steam_mac_archive_size ?? null,
    steam_launch_options_windows: game.steam_launch_options_windows ?? null,
    steam_launch_options_linux: game.steam_launch_options_linux ?? null,
    steam_launch_options_macos: game.steam_launch_options_macos ?? null,
    epic_store_url: game.epic_store_url ?? null,
    gog_store_url: game.gog_store_url ?? null,
    xbox_store_url: game.xbox_store_url ?? null,
    uplay_store_url: game.uplay_store_url ?? null,
    ea_store_url: game.ea_store_url ?? null,
    steam_app_id: game.steam_app_id ?? null,
    website: game.website ?? null,
    youtube: game.youtube ?? null,
    ai: game.ai ?? null,
    hide: game.hide ? 1 : 0,
    search_keywords: game.search_keywords ?? null,
    steam_tag_ids: game.steam_tag_ids ? JSON.stringify(game.steam_tag_ids) : null,
    source_language: game.source_language ?? null,
  };
}

/**
 * Columns that come from Supabase and must be synced on every upsert.
 * `user_unlocked` is intentionally absent here - it's a local field that must not
 * be overwritten by server data (see SYNCED_COLUMNS below and the comment
 * on UPSERT_GAME_SQL).
 */
const SYNCED_COLUMNS = [
  'kind',
  'workshop_id',
  'approved',
  'approved_at',
  'approved_by',
  'archive_hash',
  'archive_path',
  'archive_size',
  'banner_path',
  'capsule_path',
  'created_at',
  'created_by',
  'description',
  'discord',
  'downloads',
  'subscriptions',
  'editing_progress',
  'fonts_progress',
  'fundraising_current',
  'fundraising_goal',
  'game_description',
  'install_paths',
  'installation_file_linux_path',
  'installation_file_windows_path',
  'is_adult',
  'license_only',
  'logo_path',
  'name',
  'name_search',
  'platforms',
  'project_id',
  'screenshots',
  'slug',
  'status',
  'support_url',
  'team',
  'telegram',
  'textures_progress',
  'thumbnail_path',
  'translation_progress',
  'translation_updated_at',
  'twitter',
  'updated_at',
  'version',
  'video_url',
  'voice_archive_hash',
  'voice_archive_path',
  'voice_archive_size',
  'voice_progress',
  'achievements_archive_hash',
  'achievements_archive_path',
  'achievements_archive_size',
  'achievements_third_party',
  'additional_path',
  'epic_archive_hash',
  'epic_archive_path',
  'epic_archive_size',
  'gog_archive_hash',
  'gog_archive_path',
  'gog_archive_size',
  'xbox_archive_hash',
  'xbox_archive_path',
  'xbox_archive_size',
  'uplay_archive_hash',
  'uplay_archive_path',
  'uplay_archive_size',
  'ea_archive_hash',
  'ea_archive_path',
  'ea_archive_size',
  'steam_linux_archive_hash',
  'steam_linux_archive_path',
  'steam_linux_archive_size',
  'steam_mac_archive_hash',
  'steam_mac_archive_path',
  'steam_mac_archive_size',
  'steam_launch_options_windows',
  'steam_launch_options_linux',
  'steam_launch_options_macos',
  'epic_store_url',
  'gog_store_url',
  'xbox_store_url',
  'uplay_store_url',
  'ea_store_url',
  'steam_app_id',
  'website',
  'youtube',
  'ai',
  'hide',
  'search_keywords',
  'source_language',
  'steam_tag_ids',
] as const;

function _assertNever<_T extends never>(): void {
  /* compiler check */
}

type SyncedColumn = (typeof SYNCED_COLUMNS)[number];
type SyncableColumn = Exclude<keyof GameInsertParams, 'id'>;

_assertNever<Exclude<SyncableColumn, SyncedColumn>>();
_assertNever<Exclude<SyncedColumn, keyof GameInsertParams>>();

type SqliteBindable = string | number | bigint | null;
type UnbindableColumn = {
  [K in keyof GameInsertParams]-?: GameInsertParams[K] extends SqliteBindable ? never : K;
}[keyof GameInsertParams];

_assertNever<UnbindableColumn>();

/**
 * SQL for upserting a game.
 *
 * IMPORTANT: uses `ON CONFLICT ... DO UPDATE`, not `INSERT OR REPLACE`.
 * `INSERT OR REPLACE` deletes the existing row on conflict and inserts a new one,
 * so any column not listed here gets reset to its default value.
 * This breaks local (not synced from Supabase) fields, e.g. `user_unlocked`.
 * `DO UPDATE SET` only updates the listed columns, leaving others untouched.
 *
 * The column list for INSERT and SET is built from the single SYNCED_COLUMNS array,
 * so the list isn't duplicated by hand and a new column isn't forgotten in one of them.
 */
const UPSERT_GAME_SQL = `
  INSERT INTO games (
    id, ${SYNCED_COLUMNS.join(', ')}
  ) VALUES (
    @id, ${SYNCED_COLUMNS.map((c) => `@${c}`).join(', ')}
  )
  ON CONFLICT(id) DO UPDATE SET
    ${SYNCED_COLUMNS.map((c) => `${c} = excluded.${c}`).join(',\n    ')}
`;

/**
 * Check if spellfix_words table exists
 */
function hasSpellfixTable(db: Database.Database): boolean {
  const result = db
    .prepare(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='spellfix_words'"
    )
    .get() as { count: number };
  return result.count > 0;
}

/**
 * Extract unique words from game names for spellfix dictionary.
 * Only original words (no transliteration) — FTS handles transliteration separately.
 */
function extractUniqueWords(games: Game[]): string[] {
  const words = new Set<string>();
  for (const game of games) {
    for (const word of game.name.toLowerCase().split(/\s+/)) {
      const cleaned = word.replace(/[^a-zа-яіїєґ0-9]/gi, '').toLowerCase();
      if (cleaned.length >= 3) {
        words.add(cleaned);
      }
    }
  }
  return [...words];
}

/**
 * Rebuild spellfix_words dictionary from all approved games
 */
function rebuildSpellfixDictionary(db: Database.Database): void {
  if (!hasSpellfixTable(db)) {
    return;
  }

  try {
    const rows = db
      .prepare(`SELECT name FROM games WHERE ${VISIBLE_GAMES_SQL}`)
      .all() as { name: string }[];

    const games = rows.map((r) => ({ name: r.name }) as Game);
    const words = extractUniqueWords(games);

    db.exec('DELETE FROM spellfix_words');
    const insertStmt = db.prepare('INSERT INTO spellfix_words(word) VALUES (?)');
    for (const word of words) {
      insertStmt.run(word);
    }
    console.log(`[Database] Spellfix dictionary rebuilt: ${words.length} words`);
  } catch (e) {
    console.warn('[Database] Failed to rebuild spellfix dictionary:', e);
  }
}

/** The games column keeps the raw value; only the FTS copy is normalized. */
function ftsKeywords(value: string | null): string | null {
  return value ? withStrippedVariant(value) : null;
}

/**
 * Batch upsert games in a transaction
 */
export function upsertGamesTransaction(db: Database.Database, games: Game[]): void {
  const upsert = db.transaction((gamesToInsert: Game[]) => {
    const gameStmt = db.prepare(UPSERT_GAME_SQL);
    const ftsDeleteStmt = db.prepare('DELETE FROM games_fts WHERE game_id = ?');
    const ftsInsertStmt = db.prepare(
      'INSERT INTO games_fts (game_id, name_search, search_keywords) VALUES (?, ?, ?)'
    );

    for (const game of gamesToInsert) {
      const params = gameToInsertParams(game);
      gameStmt.run(params);
      ftsDeleteStmt.run(game.id);
      ftsInsertStmt.run(game.id, params.name_search, ftsKeywords(params.search_keywords));
    }
  });

  upsert(games);

  // Rebuild spellfix dictionary after batch upsert
  rebuildSpellfixDictionary(db);
}

/**
 * Upsert a single game
 */
export function upsertGameSingle(db: Database.Database, game: Game): void {
  const params = gameToInsertParams(game);
  const stmt = db.prepare(UPSERT_GAME_SQL);
  stmt.run(params);

  // Sync FTS
  db.prepare('DELETE FROM games_fts WHERE game_id = ?').run(game.id);
  db.prepare(
    'INSERT INTO games_fts (game_id, name_search, search_keywords) VALUES (?, ?, ?)'
  ).run(game.id, params.name_search, ftsKeywords(params.search_keywords));
}

export function upsertTagNames(
  db: Database.Database,
  rows: { tagid: number; name: string }[]
): void {
  const stmt = db.prepare(
    'INSERT INTO steam_tag_names (tagid, name) VALUES (?, ?) ON CONFLICT(tagid) DO UPDATE SET name = excluded.name'
  );
  db.transaction(() => {
    for (const row of rows) {
      stmt.run(row.tagid, row.name);
    }
  })();
}

/**
 * Delete a game
 */
export function deleteGameById(db: Database.Database, gameId: string): void {
  db.prepare('DELETE FROM games WHERE id = ?').run(gameId);
  db.prepare('DELETE FROM games_fts WHERE game_id = ?').run(gameId);
}
