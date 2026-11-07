import type { AchievementsBadge } from '@/shared/plugin-host-types';
import { formatBytes, parseSizeToBytes } from '../../shared/formatters';

// 'after-restart' counts: the host is installed and the strings reach Steam on its next start.
const READY_STATES: ReadonlySet<AchievementsBadge['state']> = new Set([
  'millennium',
  'decky',
  'after-restart',
]);

export interface InstallComponentChanges {
  removeVoice: boolean;
  removeAchievements: boolean;
  updateSteamArtwork: boolean;
}

interface AchievementsOptionInput {
  hasArchive: boolean;
  installed: boolean;
  checked: boolean;
  isReinstall: boolean;
  badge: AchievementsBadge | null;
}

export interface AchievementsOptionState {
  checking: boolean;
  canToggle: boolean;
  // What the installer receives: a locked box, also one without an archive, keeps the installed state, since false deletes installed strings.
  install: boolean;
  wants: boolean;
  willDownload: boolean;
  willReinstall: boolean;
  willRemove: boolean;
}

export function achievementsOptionState({
  hasArchive,
  installed,
  checked,
  isReinstall,
  badge,
}: AchievementsOptionInput): AchievementsOptionState {
  const canToggle = hasArchive && badge !== null && READY_STATES.has(badge.state);
  const wants = canToggle && checked;
  return {
    checking: hasArchive && badge === null,
    canToggle,
    install: canToggle ? checked : installed,
    wants,
    willDownload: wants && !installed,
    willReinstall: wants && installed && isReinstall,
    willRemove: canToggle && !checked && installed,
  };
}

interface SteamArtworkStartInput {
  isReinstall: boolean;
  // The record's choice from the last dialog that offered artwork
  chosen: boolean | undefined;
  applied: boolean;
  byDefault: boolean;
}

// Without a choice of the player's (no artwork was offered yet), the artwork on disk or the setting decides.
export function steamArtworkStartsChecked({
  isReinstall,
  chosen,
  applied,
  byDefault,
}: SteamArtworkStartInput): boolean {
  return isReinstall ? (chosen ?? (applied || byDefault)) : byDefault;
}

// Sums size strings like "150.00 MB"; 'N/A' when there is nothing to sum.
export function calculateTotalSize(sizes: string[]): string {
  if (sizes.length === 0) {
    return 'N/A';
  }
  if (sizes.length === 1) {
    return sizes[0];
  }
  return formatBytes(sizes.reduce((sum, size) => sum + parseSizeToBytes(size), 0));
}
