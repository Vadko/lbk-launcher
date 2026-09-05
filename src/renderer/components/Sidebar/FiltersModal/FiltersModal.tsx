import { Eye } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { TagOption } from '@/shared/types';
import type { FilterCounts } from '../../../hooks/useFilterCounts';
import { Modal } from '../../Modal/Modal';
import {
  CONTENT_TYPE_OPTIONS,
  type ContentTypeFilterType,
  LIBRARY_FILTER_OPTIONS,
  SPECIAL_FILTER_OPTIONS,
  type SpecialFilterType,
  STATUS_OPTIONS,
} from '../types';
import { ActiveFilterChips } from './ActiveFilterChips';
import { FilterPillGroup } from './FilterPillGroup';
import { CONTENT_TYPE_ICONS, LIBRARY_ICONS, STATUS_ICONS } from './filterIcons';
import { SearchableFilterList } from './SearchableFilterList';

interface FiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStatuses: string[];
  onStatusesChange: (statuses: string[]) => void;
  selectedContentTypes: ContentTypeFilterType[];
  onContentTypesChange: (types: ContentTypeFilterType[]) => void;
  specialFilter: SpecialFilterType | null;
  onSpecialFilterChange: (filter: SpecialFilterType | null) => void;
  selectedAuthors: string[];
  onAuthorsChange: (authors: string[]) => void;
  authors: string[];
  authorsLoading: boolean;
  selectedTagIds: number[];
  onTagsChange: (tagIds: number[]) => void;
  tags: TagOption[];
  tagsLoading: boolean;
  counts?: FilterCounts;
}

const SECTION_TITLE_CLASS =
  'text-xs text-text-muted font-medium uppercase tracking-wider mb-3';

export const FiltersModal: React.FC<FiltersModalProps> = ({
  isOpen,
  onClose,
  selectedStatuses,
  onStatusesChange,
  selectedContentTypes,
  onContentTypesChange,
  specialFilter,
  onSpecialFilterChange,
  selectedAuthors,
  onAuthorsChange,
  authors,
  authorsLoading,
  selectedTagIds,
  onTagsChange,
  tags,
  tagsLoading,
  counts,
}) => {
  // Selections are staged locally while the modal is open and only committed
  // to the real filters (which re-query the game list) when the modal closes
  // - via the "Переглянути" button, Escape, backdrop click or the X button -
  // so the list doesn't reshuffle under the user while they're still picking.
  const [stagedStatuses, setStagedStatuses] = useState(selectedStatuses);
  const [stagedContentTypes, setStagedContentTypes] = useState(selectedContentTypes);
  const [stagedSpecialFilter, setStagedSpecialFilter] = useState(specialFilter);
  const [stagedAuthors, setStagedAuthors] = useState(selectedAuthors);
  const [stagedTagIds, setStagedTagIds] = useState(selectedTagIds);

  /* eslint-disable react-hooks/set-state-in-effect -- intentional reset on open */
  useEffect(() => {
    if (isOpen) {
      setStagedStatuses(selectedStatuses);
      setStagedContentTypes(selectedContentTypes);
      setStagedSpecialFilter(specialFilter);
      setStagedAuthors(selectedAuthors);
      setStagedTagIds(selectedTagIds);
    }
  }, [
    isOpen,
    selectedStatuses,
    selectedContentTypes,
    specialFilter,
    selectedAuthors,
    selectedTagIds,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleClose = useCallback(() => {
    if (stagedStatuses !== selectedStatuses) {
      onStatusesChange(stagedStatuses);
    }
    if (stagedContentTypes !== selectedContentTypes) {
      onContentTypesChange(stagedContentTypes);
    }
    if (stagedSpecialFilter !== specialFilter) {
      onSpecialFilterChange(stagedSpecialFilter);
    }
    if (stagedAuthors !== selectedAuthors) {
      onAuthorsChange(stagedAuthors);
    }
    if (stagedTagIds !== selectedTagIds) {
      onTagsChange(stagedTagIds);
    }
    onClose();
  }, [
    stagedStatuses,
    selectedStatuses,
    onStatusesChange,
    stagedContentTypes,
    selectedContentTypes,
    onContentTypesChange,
    stagedSpecialFilter,
    specialFilter,
    onSpecialFilterChange,
    stagedAuthors,
    selectedAuthors,
    onAuthorsChange,
    stagedTagIds,
    selectedTagIds,
    onTagsChange,
    onClose,
  ]);

  const toggleStatus = (value: string) => {
    setStagedStatuses((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  };

  const toggleContentType = (value: string) => {
    const type = value as ContentTypeFilterType;
    setStagedContentTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleLibraryFilter = (value: string) => {
    const filter = value as SpecialFilterType;
    setStagedSpecialFilter((prev) => (prev === filter ? null : filter));
  };

  const toggleAuthor = (id: string | number) => {
    const author = id as string;
    setStagedAuthors((prev) =>
      prev.includes(author) ? prev.filter((a) => a !== author) : [...prev, author]
    );
  };

  const toggleTag = (id: string | number) => {
    const tagId = id as number;
    setStagedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const chips = useMemo(() => {
    const result: { key: string; label: string; onRemove: () => void }[] = [];

    for (const status of stagedStatuses) {
      const label = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
      result.push({
        key: `status-${status}`,
        label,
        onRemove: () => setStagedStatuses((prev) => prev.filter((s) => s !== status)),
      });
    }

    for (const type of stagedContentTypes) {
      const label = CONTENT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
      result.push({
        key: `content-${type}`,
        label,
        onRemove: () => setStagedContentTypes((prev) => prev.filter((t) => t !== type)),
      });
    }

    if (stagedSpecialFilter) {
      const label =
        SPECIAL_FILTER_OPTIONS.find((o) => o.value === stagedSpecialFilter)?.label ??
        stagedSpecialFilter;
      result.push({
        key: `special-${stagedSpecialFilter}`,
        label,
        onRemove: () => setStagedSpecialFilter(null),
      });
    }

    for (const author of stagedAuthors) {
      result.push({
        key: `author-${author}`,
        label: author,
        onRemove: () => setStagedAuthors((prev) => prev.filter((a) => a !== author)),
      });
    }

    for (const tagId of stagedTagIds) {
      const label = tags.find((t) => t.tagid === tagId)?.name ?? String(tagId);
      result.push({
        key: `tag-${tagId}`,
        label,
        onRemove: () => setStagedTagIds((prev) => prev.filter((t) => t !== tagId)),
      });
    }

    return result;
  }, [
    stagedStatuses,
    stagedContentTypes,
    stagedSpecialFilter,
    stagedAuthors,
    stagedTagIds,
    tags,
  ]);

  const visibleContentTypeOptions = CONTENT_TYPE_OPTIONS.filter(
    (option) => !counts || counts[option.value] !== 0
  );
  const visibleLibraryOptions = LIBRARY_FILTER_OPTIONS.filter(
    (option) => !counts || counts[option.value] !== 0
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Фільтри та сортування"
      usePortal
      footer={
        <button
          onClick={handleClose}
          data-gamepad-modal-item
          data-gamepad-confirm
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-color-main text-text-dark hover:opacity-90 transition-opacity"
        >
          <Eye size={16} />
          <span>Переглянути</span>
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        {chips.length > 0 && (
          <div>
            <p className={SECTION_TITLE_CLASS}>Активні фільтри</p>
            <ActiveFilterChips chips={chips} />
          </div>
        )}

        <div>
          <p className={SECTION_TITLE_CLASS}>Статус</p>
          <FilterPillGroup
            options={STATUS_OPTIONS.map((o) => ({
              label: o.label,
              value: o.value,
              count: counts?.[o.value],
              icon: STATUS_ICONS[o.value],
            }))}
            isSelected={(value) => stagedStatuses.includes(value)}
            onToggle={toggleStatus}
          />
        </div>

        {visibleContentTypeOptions.length > 0 && (
          <div>
            <p className={SECTION_TITLE_CLASS}>Тип контенту</p>
            <FilterPillGroup
              options={visibleContentTypeOptions.map((o) => ({
                label: o.label,
                value: o.value,
                count: counts?.[o.value],
                icon: CONTENT_TYPE_ICONS[o.value],
              }))}
              isSelected={(value) =>
                stagedContentTypes.includes(value as ContentTypeFilterType)
              }
              onToggle={toggleContentType}
            />
          </div>
        )}

        {visibleLibraryOptions.length > 0 && (
          <div>
            <p className={SECTION_TITLE_CLASS}>Бібліотека</p>
            <FilterPillGroup
              options={visibleLibraryOptions.map((o) => ({
                label: o.label,
                value: o.value,
                count: counts?.[o.value],
                icon: LIBRARY_ICONS[o.value],
              }))}
              isSelected={(value) => stagedSpecialFilter === value}
              onToggle={toggleLibraryFilter}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className={SECTION_TITLE_CLASS}>Автори</p>
            <SearchableFilterList
              items={authors.map((author) => ({ id: author, label: author }))}
              selectedIds={stagedAuthors}
              onToggle={toggleAuthor}
              isLoading={authorsLoading}
              searchPlaceholder="Пошук автора..."
              emptyLabel="Автора не знайдено"
            />
          </div>

          <div>
            <p className={SECTION_TITLE_CLASS}>Теги</p>
            <SearchableFilterList
              items={tags.map((tag) => ({
                id: tag.tagid,
                label: tag.name,
                count: tag.count,
              }))}
              selectedIds={stagedTagIds}
              onToggle={toggleTag}
              isLoading={tagsLoading}
              searchPlaceholder="Пошук категорії..."
              emptyLabel="Категорію не знайдено"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};
