import { create } from 'zustand';
import changelogData from '../../shared/changelog.json';

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

// changelog.json is maintained oldest-first; reversed here so index 0 is always
// the newest entry, which is what drives the notification.
export const CHANGELOG: ChangelogEntry[] = [...changelogData].reverse();

interface ChangelogStore {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

// "Already notified" state lives in useSubscriptionsStore.notifications (persisted),
// same as the app-update flow — no need to duplicate it here.
export const useChangelogStore = create<ChangelogStore>()((set) => ({
  isOpen: false,
  openModal: () => set({ isOpen: true }),
  closeModal: () => set({ isOpen: false }),
}));
