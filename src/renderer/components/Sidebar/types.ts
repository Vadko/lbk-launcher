import type { Database } from '../../../lib/database.types';
import type { Game } from '../../types/game';

export interface GameGroup {
  slug: string;
  name: string;
  translations: Game[];
}

// Status type for multi-select filter
type StatusType = Database['public']['Enums']['game_status'];

// Special filters that are single-select
export type SpecialFilterType =
  | 'installed-translations'
  | 'installed-games'
  | 'available-in-steam'
  | 'owned-gog-games'
  | 'owned-epic-games'
  | 'with-achievements'
  | 'with-voice';

export type SortOrderType = 'name' | 'downloads' | 'newest';

interface StatusFilterOption {
  label: string;
  value: StatusType;
}

interface SpecialFilterOption {
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
  { label: 'Доступно зі Steam', value: 'available-in-steam' },
  { label: 'Доступно з GOG (Heroic)', value: 'owned-gog-games' },
  { label: 'Доступно з Epic (Heroic)', value: 'owned-epic-games' },
  { label: 'З перекладом досягнень', value: 'with-achievements' },
  { label: 'З озвученням', value: 'with-voice' },
];

export const SORT_OPTIONS: { label: string; value: SortOrderType }[] = [
  { label: 'За назвою', value: 'name' },
  { label: 'За популярністю', value: 'downloads' },
  { label: 'За новизною', value: 'newest' },
];
