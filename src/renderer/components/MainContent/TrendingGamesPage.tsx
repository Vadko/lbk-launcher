import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import React from 'react';
import { Button } from '../ui/Button';
import { GamesSection } from './GamesSection';

interface TrendingGamesPageProps {
  onBack: () => void;
}

export const TrendingGamesPage: React.FC<TrendingGamesPageProps> = ({ onBack }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    className="text-left w-full max-w-[1317px] pt-[1px]"
  >
    {/* Back button */}
    <div className="mb-4">
      <Button
        variant="ghost"
        onClick={onBack}
        data-gamepad-action
        data-gamepad-primary-action
        className="flex items-center gap-2 sticky"
      >
        <ArrowLeft size={24} />
        Назад
      </Button>
    </div>

    {/* Reuse GamesSection with higher limit */}
    <GamesSection
      title="Популярне у гравців"
      showDownloadCounter={true}
      showTrendsGames={true}
      showLimit={30}
    />
  </motion.div>
);
