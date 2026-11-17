import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/renderer/store/useStore';
import { t } from '@/shared/i18n/i18n';
import { useIsTranslationInstalled } from '../../hooks/useInstalledTranslations';
import { useResource } from '../../hooks/useResource';
import { GameListItem } from '../Sidebar/GameListItem';
import { Button } from '../ui/Button';
import { Loader } from '../ui/Loader';
import { SlidingTabs } from '../ui/SlidingTabs';

export type RankedGamesKey = 'popularGames' | 'popularAllTimeGames' | 'newStarGames';

export interface RankedTabs<K extends RankedGamesKey> {
  keys: readonly K[];
  label: (key: K) => string;
  onChange: (key: K) => void;
}

interface RankedGamesSectionProps<K extends RankedGamesKey> {
  title: string;
  resourceKey: K;
  showLimit?: number;
  showDownloadCounter?: boolean;
  tabs?: RankedTabs<K>;
  onViewAll?: () => void;
}

export function RankedGamesSection<K extends RankedGamesKey>({
  title,
  resourceKey,
  showLimit = 3,
  showDownloadCounter = false,
  tabs,
  onViewAll,
}: RankedGamesSectionProps<K>) {
  const isInstalled = useIsTranslationInstalled();
  const navigate = useNavigate();

  const { gamesWithUpdates, detectedGames } = useStore(
    useShallow((state) => ({
      gamesWithUpdates: state.gamesWithUpdates,
      detectedGames: state.detectedGames,
    }))
  );
  const games = useResource(resourceKey);

  const isEmpty = games.status === 'failed' || games.value?.length === 0;
  // With tabs the header stays, so the player can switch back from a tab that has nothing
  if (isEmpty && !tabs) {
    return null;
  }
  const visibleGames = games.value?.slice(0, showLimit);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h2 className="text-4xl font-head font-semibold text-text-main">{title}</h2>
        <div className="flex flex-col items-end gap-2 ml-auto whitespace-nowrap">
          {tabs && (
            <SlidingTabs
              tabs={tabs.keys}
              active={resourceKey}
              label={tabs.label}
              onChange={tabs.onChange}
            />
          )}
          {onViewAll && (
            <Button variant="ghost" onClick={onViewAll} data-gamepad-action>
              {t('homeSections.viewAll')}
              <ArrowRightIcon size={24} />
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {isEmpty ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-3 text-center text-text-muted py-8"
            >
              {t('homeSections.noGames')}
            </motion.p>
          ) : visibleGames === undefined ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="flex items-center justify-center py-12"
            >
              <Loader size="md" />
            </motion.div>
          ) : (
            visibleGames.map((game, index) => (
              <motion.div
                key={game.id}
                id={`game-${game.slug}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: Math.min(index * 0.03, 0.5),
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
              >
                <GameListItem
                  game={game}
                  isSelected={false}
                  isCardStyle={true}
                  showDownloadCounter={showDownloadCounter}
                  hasUpdate={gamesWithUpdates.has(game.id)}
                  isGameDetected={detectedGames.has(game.id)}
                  isInstalled={isInstalled(game.id)}
                  isTranslationAvailable={
                    game.status !== 'planned' && game.status !== 'tech-improvement'
                  }
                  onClick={() => navigate(`/game/${game.id}`)}
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
