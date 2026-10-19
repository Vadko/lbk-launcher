import { DownloadIcon, ExternalLinkIcon } from 'lucide-react';
import React from 'react';
import { t } from '@/shared/i18n/i18n';
import type { SteamPluginSetupSource } from '../../../../store/useSteamPluginSetupStore';
import { openDeckySite } from '../../../../utils/steamPluginHost';
import type { LoaderFailure } from '../deckySetupMachine';
import {
  OfferDismissButtons,
  SetupButton,
  SetupCloseButton,
  SetupFooter,
  SetupProgress,
  SetupText,
  type SetupView,
} from '../SetupParts';
import { closeFooter, setupView } from './setupView';

const LOADER_OFFER_PARAGRAPHS = [
  t('deckyLoader.offerIntro'),
  t('deckyLoader.offerBenefits'),
  t('deckyLoader.offerWithout'),
  t('deckyLoader.offerInstaller'),
  t('deckyLoader.offerCaveat'),
];

const RETRYABLE: ReadonlySet<LoaderFailure> = new Set([
  'not-installed',
  'not-running',
  'download-failed',
]);

export type LoaderStage =
  | { kind: 'offer'; repair: boolean; gameMode: boolean }
  | { kind: 'installing' }
  | { kind: 'failed'; reason: LoaderFailure };

export const deckySiteButton = (primary: boolean): React.ReactNode => (
  <SetupButton
    tone={primary ? 'primary' : 'secondary'}
    onClick={openDeckySite}
    gamepad={primary ? 'confirm' : undefined}
    icon={<ExternalLinkIcon size={16} />}
  >
    {t('deckyLoader.whatIs')}
  </SetupButton>
);

interface DeckyLoaderViewProps {
  stage: LoaderStage;
  source: SteamPluginSetupSource;
  onInstall: () => void;
  onDecline: () => void;
  onClose: () => void;
}

export function deckyLoaderView({
  stage,
  source,
  onInstall,
  onDecline,
  onClose,
}: DeckyLoaderViewProps): SetupView {
  const installButton = (label: string) => (
    <SetupButton
      tone="primary"
      onClick={onInstall}
      gamepad="confirm"
      icon={<DownloadIcon size={16} />}
    >
      {label}
    </SetupButton>
  );

  switch (stage.kind) {
    case 'offer': {
      const offer = stage.repair ? [t('deckyLoader.repair')] : LOADER_OFFER_PARAGRAPHS;
      return setupView(
        t('deckySetup.title'),
        <SetupText
          paragraphs={stage.gameMode ? [...offer, t('deckyLoader.gameMode')] : offer}
        />,
        <SetupFooter>
          {!stage.gameMode &&
            installButton(
              stage.repair
                ? t('deckyLoader.repairAction')
                : t('deckyLoader.installAction')
            )}
          {deckySiteButton(stage.gameMode)}
          <OfferDismissButtons source={source} onClose={onClose} onDecline={onDecline} />
        </SetupFooter>
      );
    }
    case 'installing':
      return setupView(
        t('deckySetup.title'),
        <SetupProgress text={t('deckyLoader.installing')} percent={null} />,
        closeFooter(onClose)
      );
    case 'failed': {
      const retry = RETRYABLE.has(stage.reason);
      return setupView(
        t('deckySetup.title'),
        <SetupText
          paragraphs={[
            stage.reason === 'game-mode'
              ? t('deckyLoader.gameMode')
              : t(`deckyLoader.failure.${stage.reason}`),
          ]}
        />,
        <SetupFooter>
          {retry && installButton(t('common.tryAgain'))}
          {deckySiteButton(!retry)}
          <SetupCloseButton onClose={onClose} />
        </SetupFooter>
      );
    }
  }
}
