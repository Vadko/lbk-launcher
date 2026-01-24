import type { Platform } from '../../shared/types';

export const getReadablePlatform = (platform: string): string => {
  const platformMap: Record<Platform, string> = {
    steam: 'Steam',
    epic: 'Epic Games Store',
    gog: 'GOG',
    rockstar: 'Rockstar Games Launcher',
    emulator: 'Емулятор',
    other: 'Інша',
  };

  return platformMap[platform as Platform] ?? platform;
};
