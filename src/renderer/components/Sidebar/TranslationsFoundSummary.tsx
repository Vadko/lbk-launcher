import { useRef } from 'react';
import { t } from '@/shared/i18n/i18n';
import type { Game } from '../../../shared/types';
import { useVisibleBadgeCount } from '../../hooks/useVisibleBadgeCount';

const BADGE = 'py-1 px-2 rounded-xl bg-white/10 text-text-main whitespace-nowrap';

interface TranslationsFoundSummaryProps {
  translations: Game[];
}

export function TranslationsFoundSummary({
  translations,
}: TranslationsFoundSummaryProps) {
  const teams = [...new Set(translations.map((game) => game.team).filter(Boolean))];
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const visible = useVisibleBadgeCount(rowRef, measureRef, teams.length);
  const hidden = teams.length - visible;

  return (
    <div className="relative overflow-hidden p-3 bg-glass-hover rounded-xl mt-auto">
      <h4 className="font-semibold mb-2 truncate">
        {t('gameCard.translationsFound', { count: translations.length })}
      </h4>
      <div ref={rowRef} className="flex gap-2 min-w-0" title={teams.join(', ')}>
        {teams.slice(0, visible).map((team) => (
          <span key={team} className={`${BADGE} min-w-0 truncate`}>
            {team}
          </span>
        ))}
        {hidden > 0 && <span className={`${BADGE} shrink-0`}>+{hidden}</span>}
      </div>
      <div
        ref={measureRef}
        aria-hidden
        className="absolute left-0 top-0 w-max flex gap-2 invisible pointer-events-none"
      >
        {teams.map((team) => (
          <span key={team} className={`${BADGE} shrink-0`}>
            {team}
          </span>
        ))}
        <span className={`${BADGE} shrink-0`}>+{Math.max(teams.length - 1, 1)}</span>
      </div>
    </div>
  );
}
