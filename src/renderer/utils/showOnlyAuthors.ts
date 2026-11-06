import { useSettingsStore } from '../store/useSettingsStore';
import { useStore } from '../store/useStore';

export function showOnlyAuthors(authors: string[]): void {
  const settings = useSettingsStore.getState();
  useStore.getState().setSelectedStatuses([]);
  settings.setSpecialFilter(null);
  settings.setSelectedContentTypes([]);
  settings.setSelectedTranslationTypes([]);
  settings.setSelectedTagIds([]);
  settings.setSelectedAuthors(authors);
}
