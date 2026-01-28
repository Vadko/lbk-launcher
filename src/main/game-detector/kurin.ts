import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fetchGamesByIds } from '../api';
import { saveInstallationInfo } from '../installer/cache';

const KURIN_INSTALL_DATA_PATH = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'Kurin',
  'installData.json'
);
const KURIN_INSTALL_DATA = fs.readFileSync(KURIN_INSTALL_DATA_PATH);
const KURIN_KEY = import.meta.env.VITE_KURIN_KEY;

type KurinInstalledData = {
  selectedLocalizationId: number;
  downloadPath: string;
  lastUpdatedAt: string;
  gameDataCache: {
    name?: string;
    localizations?: Array<{
      id: number;
      name?: string;
    }>;
    gameSources?: Array<{
      name?: string;
      url?: string;
    }>;
  };
  files: Array<{
    path: string;
    hadBackup: boolean;
    isInstaller?: boolean;
  }>;
  protonVersion?: string;
};

function decryptStore() {
  try {
    const iv = KURIN_INSTALL_DATA.subarray(0, 16);
    const encryptedData = KURIN_INSTALL_DATA.subarray(17);
    const password = crypto.pbkdf2Sync(KURIN_KEY, iv.toString(), 10000, 32, 'sha512');
    const decipher = crypto.createDecipheriv('aes-256-cbc', password, iv);

    return Buffer.concat([decipher.update(encryptedData), decipher.final()]).toString(
      'utf8'
    );
  } catch (error) {
    console.error('[kurin] Decrypt Kurin install data error:', error);
    return '{"games":{}}';
  }
}

function getKurinInstalledData() {
  const data = JSON.parse(decryptStore()) as {
    games: Record<string, KurinInstalledData>;
  };

  if (!data.games) return [];

  return Object.values(data.games).map((game) => {
    const cache = game.gameDataCache || {};

    const steamUrl = cache.gameSources?.find(({ name }) => name === 'Steam')?.url;
    const idMatch = steamUrl ? steamUrl.match(/\/app\/(\d+)/) : null;
    const steamId = idMatch ? idMatch[1] : null;

    const team = cache.localizations?.find(
      ({ id }) => id === game.selectedLocalizationId
    )?.name;

    const files = (game.files || [])
      .map((file) => file.path && file.isInstaller !== true)
      .filter(Boolean) as string[];
    const hasBackup = (game.files || []).some((file) => file.hadBackup);

    return {
      steamId,
      gameName: cache.name || 'Unknown Game',
      team: team || 'Unknown Team',
      data: {
        installedAt: game.lastUpdatedAt,
        gamePath: game.downloadPath,
        hasBackup,
        isCustomPath: true,
        installedFiles: files,
        components: {
          text: {
            installed: true,
            files,
          },
        },
      },
    };
  });
}

async function createCacheFiles(games: any) {
  if (!games || games.length === 0) return;

  for (const game of games) {
    const gamePath = game.gamePath;
    await saveInstallationInfo(gamePath, game);
  }
}

export async function syncKurinGames() {
  const kurinData = getKurinInstalledData();
  const gameIds = kurinData
    .map((item) => item.steamId)
    .filter((id): id is string => !!id);

  if (gameIds.length === 0) {
    console.log('[kurin] No Kurin installed games found.');
    return;
  }
  const games = fetchGamesByIds(gameIds, undefined, false, true);

  const syncedGames = games
    .map((game) => {
      const kurinGame = kurinData.find(
        ({ steamId, team }) =>
          steamId === String(game.steam_app_id) &&
          (team === game.team || team === 'Спільнота')
      );
      if (!kurinGame) return null;
      return {
        gameId: game.id,
        version: game.version,
        ...kurinGame.data,
      };
    })
    .filter(Boolean);

  await createCacheFiles(syncedGames);

  console.log('Synced Kurin games data:', syncedGames);
}
