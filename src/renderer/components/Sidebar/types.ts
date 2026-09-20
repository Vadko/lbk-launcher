import type { Database } from '../../../lib/database.types';
import type { SortOrderType } from '../../../shared/types';
import type { Game } from '../../types/game';

export type { SortOrderType };

export interface GameGroup {
  key: string;
  name: string;
  translations: Game[];
  variantById: Map<string, string>;
}

// Status type for multi-select filter
type StatusType = Database['public']['Enums']['game_status'];

// Special filters that are single-select (library/ownership source - mutually exclusive)
export type SpecialFilterType =
  | 'installed-translations'
  | 'installed-games'
  | 'available-in-steam'
  | 'owned-gog-games'
  | 'owned-epic-games'
  | 'installed-xbox-games'
  | 'favorite-translations';

// Content-type filters - multi-select, combined with AND (both can be selected at once)
export type ContentTypeFilterType = 'with-achievements' | 'with-voice' | 'from-workshop';

interface StatusFilterOption {
  label: string;
  value: StatusType;
}

interface SpecialFilterOption {
  label: string;
  value: SpecialFilterType;
}

interface ContentTypeFilterOption {
  label: string;
  value: ContentTypeFilterType;
}

// Status options for multi-select
export const STATUS_OPTIONS: StatusFilterOption[] = [
  { label: 'Заплановано', value: 'planned' },
  { label: 'Ранній доступ', value: 'in-progress' },
  { label: 'Готово', value: 'completed' },
  { label: 'Технічна доробка', value: 'tech-improvement' },
];

// Special filter options (single-select, separate from statuses)
export const SPECIAL_FILTER_OPTIONS: SpecialFilterOption[] = [
  { label: 'Улюблені українізатори', value: 'favorite-translations' },
  { label: 'Встановлені українізатори', value: 'installed-translations' },
  { label: 'Встановлені ігри', value: 'installed-games' },
  { label: 'Доступно зі Steam', value: 'available-in-steam' },
  { label: 'Доступно з GOG', value: 'owned-gog-games' },
  { label: 'Доступно з Epic', value: 'owned-epic-games' },
  { label: 'Встановлено з Xbox app', value: 'installed-xbox-games' },
];

// Same field as SPECIAL_FILTER_OPTIONS, minus the two options exposed as
// standalone quick-filter buttons on the sidebar panel (favorites, installed
// translations) - shown in the filters modal's "Бібліотека" section instead.
export const LIBRARY_FILTER_OPTIONS: SpecialFilterOption[] =
  SPECIAL_FILTER_OPTIONS.filter(
    (option) =>
      option.value !== 'favorite-translations' &&
      option.value !== 'installed-translations'
  );

// Content-type options (multi-select, AND'ed together - e.g. can require both)
export const CONTENT_TYPE_OPTIONS: ContentTypeFilterOption[] = [
  { label: 'З перекладом досягнень', value: 'with-achievements' },
  { label: 'З озвученням', value: 'with-voice' },
  { label: 'З Майстерні Steam', value: 'from-workshop' },
];

export const SORT_OPTIONS: { label: string; value: SortOrderType }[] = [
  { label: 'За назвою', value: 'name' },
  { label: 'За популярністю', value: 'downloads' },
  { label: 'За кількістю підписників', value: 'subscribers' },
  { label: 'За новизною', value: 'newest' },
];
