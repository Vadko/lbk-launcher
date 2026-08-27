import { create } from 'zustand';
import changelogData from '../../shared/changelog.json';
import type { ChangelogEntry } from '../../shared/types';

export function compareVersions(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
  const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
  return aMajor - bMajor || aMinor - bMinor || aPatch - bPatch;
}

function sortNewestFirst(entries: ChangelogEntry[]): ChangelogEntry[] {
  return [...entries].sort((a, b) => compareVersions(b.version, a.version));
}

const BUNDLED: ChangelogEntry[] = sortNewestFirst(changelogData);

function merge(remote: ChangelogEntry[]): ChangelogEntry[] {
  const byVersion = new Map(BUNDLED.map((entry) => [entry.version, entry]));
  for (const entry of remote) {
    byVersion.set(entry.version, entry);
  }
  return sortNewestFirst([...byVersion.values()]);
}

interface ChangelogStore {
  isOpen: boolean;
  entries: ChangelogEntry[];
  openModal: () => void;
  closeModal: () => void;
  loadForVersion: (version: string) => Promise<void>;
}

export const useChangelogStore = create<ChangelogStore>()((set) => ({
  isOpen: false,
  entries: BUNDLED,
  openModal: () => set({ isOpen: true }),
  closeModal: () => set({ isOpen: false }),

  loadForVersion: async (version) => {
    const remote = await window.electronAPI?.fetchChangelog?.(version);
    if (remote?.length) {
      set({ entries: merge(remote) });
    }
  },
}));
