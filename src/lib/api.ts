import { supabase } from './supabase';
import type { Game } from '../shared/types';
import type { Database } from './database.types';

type InstallSource = Database['public']['Enums']['install_source'];

function parseInstallPaths(paths: unknown): Record<InstallSource, string | undefined> {
  if (!paths || typeof paths !== 'object') return { steam: undefined, gog: undefined };
  const obj = paths as Record<string, unknown>;
  return {
    steam: typeof obj.steam === 'string' ? obj.steam : undefined,
    gog: typeof obj.gog === 'string' ? obj.gog : undefined,
  };
}

/**
 * Отримати список затверджених перекладів
 */
export async function getApprovedGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('approved', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching games:', error);
    return [];
  }

  return (data || []).map((game): Game => ({
    id: game.id,
    slug: game.slug,
    name: game.name,
    version: game.version,
    translation_progress: game.translation_progress,
    editing_progress: game.editing_progress,
    team: game.team,
    status: game.status,
    platforms: game.platforms,
    install_paths: parseInstallPaths(game.install_paths),
    archive_path: game.archive_path || '',
    banner_path: game.banner_path,
    logo_path: game.logo_path,
    thumbnail_path: game.thumbnail_path,
    game_description: game.game_description,
    description: game.description,
    support_url: game.support_url,
    video_url: game.video_url,
  }));
}

/**
 * Отримати публічне URL для завантаження архіву
 */
export function getArchiveDownloadUrl(archivePath: string): string {
  const { data } = supabase.storage
    .from('game-archives')
    .getPublicUrl(archivePath);

  return data.publicUrl;
}

/**
 * Отримати URL зображення
 */
export function getImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;

  const { data } = supabase.storage
    .from('game-images')
    .getPublicUrl(imagePath);

  return data.publicUrl;
}

/**
 * Перевірити оновлення конкретної гри
 */
export async function checkGameUpdate(currentGameId: string, currentVersion: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('games')
    .select('version')
    .eq('id', currentGameId)
    .eq('approved', true)
    .single();

  if (error || !data) return false;

  return data.version !== currentVersion;
}

/**
 * Підписатися на оновлення ігор (Real-time)
 */
export function subscribeToGameUpdates(callback: (game: Game) => void) {
  const channel = supabase
    .channel('game-updates')
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'games',
        filter: 'approved=eq.true',
      },
      (payload) => {
        console.log('Game updated:', payload.new);
        if (payload.new) {
          callback(payload.new as Game);
        }
      }
    )
    .subscribe();

  return () => channel.unsubscribe();
}
