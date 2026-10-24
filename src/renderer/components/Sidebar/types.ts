import type { Database } from '../../../lib/database.types';
import type {
  ContentTypeFilterType,
  Game,
  SortOrderType,
  SpecialFilterType,
  TranslationTypeFilterType,
} from '../../../shared/types';

export interface GameGroup {
  key: string;
  name: string;
  translations: Game[];
  variantById: Map<string, string>;
}

// Status type for multi-select filter
type StatusType = Database['public']['Enums']['game_status'];

// Status options for multi-select
export const STATUS_OPTIONS: StatusType[] = [
  'planned',
  'in-progress',
  'completed',
  'tech-improvement',
];

// Special filter options (single-select, separate from statuses)
const SPECIAL_FILTER_OPTIONS: SpecialFilterType[] = [
  'favorite-translations',
  'installed-translations',
  'installed-games',
  'available-in-steam',
  'owned-gog-games',
  'owned-epic-games',
  'installed-xbox-games',
];

// Same field as SPECIAL_FILTER_OPTIONS, minus the two options exposed as
// standalone quick-filter buttons on the sidebar panel (favorites, installed
// translations) - shown in the filters modal's "Бібліотека" section instead.
export const LIBRARY_FILTER_OPTIONS: SpecialFilterType[] = SPECIAL_FILTER_OPTIONS.filter(
  (option) => option !== 'favorite-translations' && option !== 'installed-translations'
);

// Content-type options (multi-select, AND'ed together - e.g. can require both)
export const CONTENT_TYPE_OPTIONS: ContentTypeFilterType[] = [
  'with-achievements',
  'with-voice',
  'from-workshop',
];

// Translation-type options (multi-select, OR'ed together - a game matches one of them)
export const TRANSLATION_TYPE_OPTIONS: TranslationTypeFilterType[] = [
  'manual',
  'ai',
  'ai-edited',
];

export const SORT_OPTIONS = [
  'name',
  'downloads',
  'subscribers',
  'newest',
] as const satisfies readonly SortOrderType[];
