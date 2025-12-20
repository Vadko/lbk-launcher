import type { Database } from '../../../lib/database.types';
import type { Game } from '../../types/game';

export interface GameGroup {
  slug: string;
  name: string;
  translations: Game[];
}

// Status type for multi-select filter
export type StatusType = Database['public']['Enums']['game_status'];

// Special filters that are single-select
export type SpecialFilterType = 'installed-translations' | 'installed-games';

export interface StatusFilterOption {
  label: string;
  value: StatusType;
}

export interface SpecialFilterOption {
  label: string;
  value: SpecialFilterType;
}

// Status options for multi-select
export const STATUS_OPTIONS: StatusFilterOption[] = [
  { label: 'Заплановано', value: 'planned' },
  { label: 'Ранній доступ', value: 'in-progress' },
  { label: 'Готово', value: 'completed' },
];

// Special filter options (single-select, separate from statuses)
export const SPECIAL_FILTER_OPTIONS: SpecialFilterOption[] = [
  { label: 'Встановлені українізатори', value: 'installed-translations' },
  { label: 'Встановлені ігри', value: 'installed-games' },
];
