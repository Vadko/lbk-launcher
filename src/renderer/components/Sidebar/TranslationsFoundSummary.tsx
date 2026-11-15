import { t } from '@/shared/i18n/i18n';
import type { Game } from '../../../shared/types';

interface TranslationsFoundSummaryProps {
  translations: Game[];
}

export function TranslationsFoundSummary({
  translations,
}: TranslationsFoundSummaryProps) {
  const teams = [...new Set(translations.map((game) => game.team).filter(Boolean))];

  return (
    <div className="p-3 bg-glass-hover rounded-xl mt-auto">
      <h4 className="font-semibold mb-2 truncate">
        {t('gameCard.translationsFound', { count: translations.length })}
      </h4>
      <div
        className="grid grid-flow-col auto-cols-[minmax(0,max-content)] gap-2"
        title={teams.join(', ')}
      >
        {teams.map((team) => (
          <span
            key={team}
            className="py-1 px-2 rounded-xl bg-white/10 text-text-main truncate"
          >
            {team}
          </span>
        ))}
      </div>
    </div>
  );
}
