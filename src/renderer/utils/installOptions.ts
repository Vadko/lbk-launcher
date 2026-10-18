import type { AchievementsBadge } from '@/shared/plugin-host-types';

// 'after-restart' counts: the host is installed and the strings reach Steam on its next start.
const READY_STATES: ReadonlySet<AchievementsBadge['state']> = new Set([
  'millennium',
  'decky',
  'after-restart',
]);

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
  // What the installer receives: a locked box keeps the installed state, since false deletes installed strings.
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
    install: hasArchive && (canToggle ? checked : installed),
    wants,
    willDownload: wants && !installed,
    willReinstall: wants && installed && isReinstall,
    willRemove: canToggle && !checked && installed,
  };
}

const SIZE_MULTIPLIERS: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
};

function parseSize(sizeStr: string): number {
  const match = sizeStr.trim().match(/([\d.]+)\s*(B|KB|MB|GB)/i);
  if (!match) {
    return 0;
  }
  return parseFloat(match[1]) * (SIZE_MULTIPLIERS[match[2].toUpperCase()] || 0);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Sums size strings like "150.00 MB"; 'N/A' when there is nothing to sum.
export function calculateTotalSize(sizes: string[]): string {
  if (sizes.length === 0) {
    return 'N/A';
  }
  if (sizes.length === 1) {
    return sizes[0];
  }
  return formatSize(sizes.reduce((sum, size) => sum + parseSize(size), 0));
}
