import type { Game } from '../../../shared/types';
import { isTranslationInstallable } from '../../utils/gameStatus';
import { StatusBadge } from '../Elements/StatusBadge';

interface TranslationSummaryProps {
  game: Game;
  variant?: string;
}

export function TranslationSummary({ game, variant }: TranslationSummaryProps) {
  const averageProgress = Math.round(
    (game.translation_progress + game.editing_progress) / 2
  );

  return (
    <div className="p-3 bg-glass-hover rounded-xl">
      <h4 className="font-semibold mb-2 truncate" title={game.team}>
        {game.team}
        {variant && <span className="text-text-muted text-xs"> {variant}</span>}
      </h4>

      <div className="flex gap-3 items-center w-full flex-wrap">
        {game.status && (
          <StatusBadge
            status={game.status}
            style="capsule"
            className="shrink-0 py-1 px-2 bg-[rgba(168,207,150,0.25)] rounded-xl"
          />
        )}
        {isTranslationInstallable(game.status) && (
          <div className="flex items-center gap-3 flex-1">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden grow">
              <div
                className="h-full bg-linear-to-r/srgb from-color-accent to-color-main rounded-full transition-all duration-500"
                style={{ width: `${averageProgress}%` }}
              />
            </div>
            <span className="text-text-main font-bold">{`${averageProgress}%`}</span>
          </div>
        )}
      </div>
    </div>
  );
}
