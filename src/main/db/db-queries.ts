/**
 * Спільні SQL запити та утиліти для роботи з базою даних
 * Використовується в games-repository.ts та db-worker.ts
 */
import type Database from 'better-sqlite3';
import { generateSearchableString } from '../../shared/search-utils';
import type { Game, Database as SupabaseDatabase } from '../../shared/types';

/**
 * Поля, які не зберігаються в локальній БД
 */
type ExcludedLocalFields =
  | 'archive_file_list'
  | 'voice_archive_file_list'
  | 'achievements_archive_file_list'
  | 'epic_archive_file_list'
  | 'name_fts'; // Generated column in Supabase for FTS

/**
 * Параметри для вставки гри в БД (локальну SQLite)
 * Mapped type на основі Supabase Database типів, але з перетвореннями для SQLite:
 * - boolean -> number (0/1)
 * - arrays/objects -> JSON string
 * - Виключені поля file_list
 */
export type GameInsertParams = {
  [K in keyof Omit<
    SupabaseDatabase['public']['Tables']['games']['Row'],
    ExcludedLocalFields
  >]: K extends 'approved' | 'is_adult' | 'license_only' | 'hide'
    ? number // boolean перетворюється на 0/1 для SQLite
    : K extends 'ai'
      ? string | null // ai тепер текстове поле: 'edited' | 'non-edited' | null
      : K extends 'platforms' | 'install_paths'
        ? string | null // JSON.stringify для SQLite
        : SupabaseDatabase['public']['Tables']['games']['Row'][K];
} & {
  // Local-only field for search (not in Supabase)
  name_search: string;
};

/**
 * Конвертувати Game в параметри для вставки в БД
 */
export function gameToInsertParams(game: Game): GameInsertParams {
  return {
    id: game.id,
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
    slug: game.slug ?? null,
    status: game.status ?? null,
    support_url: game.support_url ?? null,
    team: game.team ?? null,
    telegram: game.telegram ?? null,
    textures_progress: game.textures_progress ?? null,
    thumbnail_path: game.thumbnail_path ?? null,
    translation_progress: game.translation_progress ?? null,
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
    steam_app_id: game.steam_app_id ?? null,
    website: game.website ?? null,
    youtube: game.youtube ?? null,
    ai: game.ai ?? null,
    hide: game.hide ? 1 : 0,
  };
}

/**
 * SQL для upsert гри
 */
export const UPSERT_GAME_SQL = `
  INSERT OR REPLACE INTO games (
    id, approved, approved_at, approved_by, archive_hash, archive_path, archive_size,
    banner_path, capsule_path, created_at, created_by, description, discord, downloads, subscriptions, editing_progress,
    fonts_progress, fundraising_current, fundraising_goal, game_description, install_paths,
    installation_file_linux_path, installation_file_windows_path, is_adult, license_only, logo_path,
    name, name_search, platforms, project_id, slug, status, support_url, team, telegram, textures_progress,
    thumbnail_path, translation_progress, twitter, updated_at, version, video_url,
    voice_archive_hash, voice_archive_path, voice_archive_size,
    voice_progress, achievements_archive_hash, achievements_archive_path, achievements_archive_size,
    achievements_third_party, additional_path,
    epic_archive_hash, epic_archive_path, epic_archive_size,
    steam_app_id, website, youtube, ai, hide
  ) VALUES (
    @id, @approved, @approved_at, @approved_by, @archive_hash, @archive_path, @archive_size,
    @banner_path, @capsule_path, @created_at, @created_by, @description, @discord, @downloads, @subscriptions, @editing_progress,
    @fonts_progress, @fundraising_current, @fundraising_goal, @game_description, @install_paths,
    @installation_file_linux_path, @installation_file_windows_path, @is_adult, @license_only, @logo_path,
    @name, @name_search, @platforms, @project_id, @slug, @status, @support_url, @team, @telegram, @textures_progress,
    @thumbnail_path, @translation_progress, @twitter, @updated_at, @version, @video_url,
    @voice_archive_hash, @voice_archive_path, @voice_archive_size,
    @voice_progress, @achievements_archive_hash, @achievements_archive_path, @achievements_archive_size,
    @achievements_third_party, @additional_path,
    @epic_archive_hash, @epic_archive_path, @epic_archive_size,
    @steam_app_id, @website, @youtube, @ai, @hide
  )
`;

/**
 * Batch upsert ігор в транзакції
 */
export function upsertGamesTransaction(db: Database.Database, games: Game[]): void {
  const upsert = db.transaction((gamesToInsert: Game[]) => {
    const gameStmt = db.prepare(UPSERT_GAME_SQL);
    const ftsDeleteStmt = db.prepare('DELETE FROM games_fts WHERE game_id = ?');
    const ftsInsertStmt = db.prepare(
      'INSERT INTO games_fts (game_id, name_search) VALUES (?, ?)'
    );

    for (const game of gamesToInsert) {
      const params = gameToInsertParams(game);
      gameStmt.run(params);
      ftsDeleteStmt.run(game.id);
      ftsInsertStmt.run(game.id, params.name_search);
    }
  });

  upsert(games);
}

/**
 * Upsert однієї гри
 */
export function upsertGameSingle(db: Database.Database, game: Game): void {
  const params = gameToInsertParams(game);
  const stmt = db.prepare(UPSERT_GAME_SQL);
  stmt.run(params);

  // Sync FTS
  db.prepare('DELETE FROM games_fts WHERE game_id = ?').run(game.id);
  db.prepare('INSERT INTO games_fts (game_id, name_search) VALUES (?, ?)').run(
    game.id,
    params.name_search
  );
}

/**
 * Видалити гру
 */
export function deleteGameById(db: Database.Database, gameId: string): void {
  db.prepare('DELETE FROM games WHERE id = ?').run(gameId);
  db.prepare('DELETE FROM games_fts WHERE game_id = ?').run(gameId);
}
