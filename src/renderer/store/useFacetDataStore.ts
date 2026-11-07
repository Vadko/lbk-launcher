import { create } from 'zustand';
import type { FacetRow, LibraryMemberships, TagOption } from '../../shared/types';

interface FacetDataStore {
  rows: FacetRow[] | null;
  libraries: LibraryMemberships | null;
  installedTranslationIds: readonly string[] | null;
  teams: string[] | null;
  tags: TagOption[] | null;
  setRows: (rows: FacetRow[] | null) => void;
  setLibraries: (libraries: LibraryMemberships | null) => void;
  setInstalledTranslationIds: (ids: readonly string[]) => void;
  setFilterOptions: (teams: string[], tags: TagOption[]) => void;
}

// A failed read keeps what is already counted
export const useFacetDataStore = create<FacetDataStore>((set) => ({
  rows: null,
  libraries: null,
  installedTranslationIds: null,
  teams: null,
  tags: null,
  setRows: (rows) => set((state) => ({ rows: rows ?? state.rows })),
  setLibraries: (libraries) =>
    set((state) => ({ libraries: libraries ?? state.libraries })),
  setInstalledTranslationIds: (installedTranslationIds) =>
    set({ installedTranslationIds }),
  setFilterOptions: (teams, tags) => set({ teams, tags }),
}));
