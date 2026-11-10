import { LanguagesIcon } from 'lucide-react';
import { t } from '@/shared/i18n/i18n';
import { isLanguage, LANGUAGES } from '@/shared/i18n/languages';
import { useSettingsStore } from '../../store/useSettingsStore';
import { SelectDropdown } from '../ui/SelectDropdown';

export function LanguageSetting() {
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-glass border border-border">
      <div className="w-10 h-10 rounded-lg bg-linear-to-br/srgb from-color-main to-color-accent flex items-center justify-center shrink-0">
        <LanguagesIcon size={20} className="text-text-dark" />
      </div>
      <div className="flex-1 text-left">
        <h4 className="text-sm font-semibold text-text-main">
          {t('settings.language.title')}
        </h4>
        <p className="text-xs text-text-muted">{t('settings.language.description')}</p>
      </div>
      <SelectDropdown
        className="w-44 shrink-0"
        options={LANGUAGES.map((value) => ({
          name: t(`settings.language.names.${value}`),
          value,
        }))}
        selectedValue={language}
        onSelectionChange={(value) => {
          if (isLanguage(value)) {
            setLanguage(value);
          }
        }}
      />
    </div>
  );
}
