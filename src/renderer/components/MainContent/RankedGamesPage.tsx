import { motion } from 'framer-motion';
import { ArrowLeftIcon } from 'lucide-react';
import { t } from '@/shared/i18n/i18n';
import { Button } from '../ui/Button';
import {
  type RankedGamesKey,
  RankedGamesSection,
  type RankedTabs,
} from './RankedGamesSection';

interface RankedGamesPageProps<K extends RankedGamesKey> {
  title: string;
  resourceKey: K;
  showDownloadCounter?: boolean;
  tabs?: RankedTabs<K>;
  onBack: () => void;
}

export function RankedGamesPage<K extends RankedGamesKey>({
  title,
  resourceKey,
  showDownloadCounter = false,
  tabs,
  onBack,
}: RankedGamesPageProps<K>) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="pt-px"
    >
      <div className="mb-4">
        <Button
          variant="ghost"
          onClick={onBack}
          data-gamepad-action
          data-gamepad-primary-action
          className="flex items-center gap-2 sticky"
        >
          <ArrowLeftIcon size={24} />
          {t('homeSections.back')}
        </Button>
      </div>

      <RankedGamesSection
        title={title}
        resourceKey={resourceKey}
        showDownloadCounter={showDownloadCounter}
        tabs={tabs}
        showLimit={30}
      />
    </motion.section>
  );
}
