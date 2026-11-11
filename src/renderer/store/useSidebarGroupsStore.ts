import { create } from 'zustand';

interface SidebarGroupsStore {
  // The game groups the player opened in the sidebar list
  expanded: ReadonlySet<string>;
  toggle: (key: string) => void;
}

export const useSidebarGroupsStore = create<SidebarGroupsStore>((set) => ({
  expanded: new Set(),
  toggle: (key) =>
    set(({ expanded }) => {
      const next = new Set(expanded);
      if (!next.delete(key)) {
        next.add(key);
      }
      return { expanded: next };
    }),
}));
