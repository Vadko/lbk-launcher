import {
  CircleArrowUpIcon,
  DownloadIcon,
  ExternalLinkIcon,
  RotateCwIcon,
  WrenchIcon,
} from 'lucide-react';
import React from 'react';
import { t } from '@/shared/i18n/i18n';
import type { PluginHostState } from '@/shared/plugin-host-types';
import type { SteamPluginSetupSource } from '../../../../store/useSteamPluginSetupStore';
import {
  hostOs,
  millenniumUnsupportedText,
  openMillenniumSite,
} from '../../../../utils/steamPluginHost';
import { introMode, queuedParagraphs } from '../millenniumSetup';
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

export const millenniumSiteButton = (): React.ReactNode => (
  <SetupButton
    tone="primary"
    onClick={openMillenniumSite}
    gamepad="confirm"
    icon={<ExternalLinkIcon size={16} />}
  >
    {t('millenniumSetup.openSite')}
  </SetupButton>
);

function offerParagraphs(): string[] {
  const os = hostOs();
  const paragraphs: string[] = [
    t('millenniumSetup.offer.intro'),
    os === 'macos'
      ? t('millenniumSetup.offer.benefitsMac')
      : t('millenniumSetup.offer.benefits'),
    t('millenniumSetup.offer.withoutMillennium'),
    os === 'macos'
      ? t('millenniumSetup.offer.sourceMac')
      : t('millenniumSetup.offer.source'),
    os === 'windows'
      ? t('millenniumSetup.offer.caveatWindows')
      : t('millenniumSetup.offer.caveat'),
  ];
  if (os === 'linux') {
    paragraphs.push(t('millenniumSetup.offer.linux'));
  }
  if (os === 'macos') {
    paragraphs.push(t('millenniumSetup.offer.macos'));
  }
  paragraphs.push(t('millenniumSetup.offer.restart'));
  return paragraphs;
}

interface MillenniumIntroViewProps {
  state: PluginHostState | null;
  source: SteamPluginSetupSource;
  onInstall: () => void;
  onRestartSteam: () => void;
  onDecline: () => void;
  onClose: () => void;
}

export function millenniumIntroView({
  state,
  source,
  onInstall,
  onRestartSteam,
  onDecline,
  onClose,
}: MillenniumIntroViewProps): SetupView {
  const mode = introMode(state);
  const busy = state?.busy === true;

  switch (mode) {
    case 'loading':
      return setupView(
        t('millenniumSetup.title'),
        <SetupProgress text={t('common.checkingSystem')} percent={null} />,
        closeFooter(onClose)
      );
    case 'unsupported':
    case 'external': {
      const reason = state?.millennium.unsupportedReason ?? null;
      return setupView(
        t('millenniumSetup.title'),
        <SetupText
          paragraphs={[
            mode === 'external'
              ? t('millenniumSetup.external')
              : millenniumUnsupportedText(reason),
          ]}
        />,
        <SetupFooter>
          {mode === 'unsupported' && reason === 'millennium-v2' && millenniumSiteButton()}
          <SetupCloseButton onClose={onClose} />
        </SetupFooter>
      );
    }
    case 'pending':
      return setupView(
        t('millenniumSetup.title'),
        <SetupText paragraphs={queuedParagraphs()} />,
        <SetupFooter>
          {state?.steamRunning && state.canRestartSteam && (
            <SetupButton
              tone="primary"
              onClick={onRestartSteam}
              disabled={busy}
              gamepad="confirm"
              icon={<RotateCwIcon size={16} />}
            >
              {t('common.restartSteamNow')}
            </SetupButton>
          )}
          <SetupCloseButton onClose={onClose} />
        </SetupFooter>
      );
    case 'update':
    case 'repair':
      return setupView(
        mode === 'update'
          ? t('millenniumSetup.updateTitle')
          : t('millenniumSetup.repairTitle'),
        <SetupText
          paragraphs={[
            mode === 'update'
              ? t('millenniumSetup.updateAvailable', {
                  version: state?.millennium.update?.version ?? '',
                })
              : t('millenniumSetup.filesBroken'),
            t('millenniumSetup.restartNeeded'),
          ]}
        />,
        <SetupFooter>
          <SetupButton
            tone="primary"
            onClick={onInstall}
            disabled={busy}
            gamepad="confirm"
            icon={
              mode === 'update' ? (
                <CircleArrowUpIcon size={16} />
              ) : (
                <WrenchIcon size={16} />
              )
            }
          >
            {mode === 'update'
              ? t('millenniumSetup.update')
              : t('millenniumSetup.repair')}
          </SetupButton>
          <SetupButton tone="secondary" onClick={onClose} gamepad="cancel">
            {t('common.cancel')}
          </SetupButton>
        </SetupFooter>
      );
    case 'offer':
      return setupView(
        t('millenniumSetup.title'),
        <SetupText paragraphs={offerParagraphs()} />,
        <SetupFooter>
          <SetupButton
            tone="primary"
            onClick={onInstall}
            disabled={busy}
            gamepad="confirm"
            icon={<DownloadIcon size={16} />}
          >
            {t('millenniumSetup.install')}
          </SetupButton>
          <OfferDismissButtons source={source} onClose={onClose} onDecline={onDecline} />
        </SetupFooter>
      );
  }
}
