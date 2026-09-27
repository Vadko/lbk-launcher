import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import React from 'react';
import { Button } from '../ui/Button';
import { TrendGamesSection } from './TrendsGamesSection';

interface TrendingGamesPageProps {
  onBack: () => void;
}

export const TrendingGamesPage: React.FC<TrendingGamesPageProps> = ({ onBack }) => (
  <motion.section
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    className="pt-[1px]"
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
    <TrendGamesSection
      title="Популярне у гравців"
      showDownloadCounter={true}
      showLimit={30}
    />
  </motion.section>
);
