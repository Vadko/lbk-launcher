import { t } from '@/shared/i18n/i18n';
import type { Game } from '../../../shared/types';

interface TranslationsFoundSummaryProps {
  translations: Game[];
}

export function TranslationsFoundSummary({
  translations,
}: TranslationsFoundSummaryProps) {
  const teams = [...new Set(translations.map((game) => game.team).filter(Boolean))].join(
    ', '
  );

  return (
    <div className="p-3 bg-glass-hover rounded-xl mt-auto">
      <h4 className="font-semibold mb-2 truncate">
        {t('gameCard.translationsFound', { count: translations.length })}
      </h4>
      <p className="text-text-muted truncate leading-7" title={teams}>
        {teams}
      </p>
    </div>
  );
}
