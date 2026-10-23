import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { getEglAppId, getEglDataRoot } from '../game-detector/egl-linux';
import { writeFileAtomic } from './atomic-write';
import { readJsonFile } from './json-file';
import { parseLaunchCommand } from './launch-command';
import { mergeLaunchOptions } from './launch-options-value';

// EGL's per-game «Additional Command Line Arguments»
const gameEntrySchema = z.object({
  additionalCommandsEnabled: z.boolean().optional(),
  additionalCommands: z.string().optional(),
});
// Loose so a rewrite keeps the fields EGL owns
const gameSettingsSchema = z
  .object({ games: z.record(z.string(), gameEntrySchema.loose()).optional() })
  .loose();

type GameEntry = z.infer<typeof gameEntrySchema>;

// What EGL writes on its first save; it reads the file again before every launch
const NEW_SETTINGS: { games: Record<string, GameEntry>; [key: string]: unknown } = {
  games: {},
  addons: {},
  cloudSaves: {},
  pendingShortcuts: {},
};
const NEW_GAME_ENTRY = { autoUpdate: true, priorityDownload: false };

function getGameSettingsPath(): string | null {
  const root = getEglDataRoot();
  return root && path.join(root, 'settings/game-settings.json');
}

function enabledCommands(entry: GameEntry | undefined): string {
  return entry?.additionalCommandsEnabled ? (entry.additionalCommands ?? '') : '';
}

export function readEglLaunchArgs(gameDir: string): string[] {
  const file = getGameSettingsPath();
  const appId = getEglAppId(gameDir);
  if (!file || !appId) {
    return [];
  }
  const entry = readJsonFile(file, gameSettingsSchema)?.games?.[appId];
  return parseLaunchCommand(enabledCommands(entry))?.args ?? [];
}

// Merged like the Steam launch options, so the player's own args stay; args they switched off are replaced
export function addEglLaunchArgs(gameDir: string, argsText: string): boolean {
  const file = getGameSettingsPath();
  const appId = getEglAppId(gameDir);
  if (!file || !appId) {
    return false;
  }
  // A file EGL never wrote starts as EGL's own; one it can't parse is left alone
  const settings = fs.existsSync(file)
    ? readJsonFile(file, gameSettingsSchema)
    : NEW_SETTINGS;
  if (!settings) {
    return false;
  }
  const entry = settings.games?.[appId];
  const current = enabledCommands(entry);
  const next = mergeLaunchOptions(current, argsText);
  if (entry?.additionalCommandsEnabled && next === current) {
    return true;
  }
  const games = {
    ...settings.games,
    [appId]: {
      ...NEW_GAME_ENTRY,
      ...entry,
      additionalCommandsEnabled: true,
      additionalCommands: next,
    },
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeFileAtomic(file, JSON.stringify({ ...settings, games }, null, 2));
  return true;
}
