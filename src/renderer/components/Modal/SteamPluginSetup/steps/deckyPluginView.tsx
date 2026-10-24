import { Download } from 'lucide';
import { CircleArrowUpIcon } from 'lucide-react';
import type { ActionPhase } from '@/renderer/hooks/useActionPhase';
import { t } from '@/shared/i18n/i18n';
import type { PluginHostState } from '@/shared/plugin-host-types';
import type { SteamPluginSetupSource } from '../../../../store/useSteamPluginSetupStore';
import { deckyOffer } from '../../../../utils/pluginHostOffer';
import { AppActionIcon } from '../../../ui/AppActionIcon';
import {
  OfferDismissButtons,
  SetupButton,
  SetupCloseButton,
  SetupFooter,
  SetupProgress,
  SetupText,
  type SetupView,
} from '../SetupParts';
import { deckySiteButton } from './deckyLoaderView';
import { closeFooter, setupView } from './setupView';

interface DeckyPluginViewProps {
  state: PluginHostState | null;
  source: SteamPluginSetupSource;
  loaderInstalled: boolean;
  requestPhase: ActionPhase;
  isRequesting: boolean;
  onRequest: () => void;
  onDecline: () => void;
  onClose: () => void;
}

export function deckyPluginView({
  state,
  source,
  loaderInstalled,
  requestPhase,
  isRequesting,
  onRequest,
  onDecline,
  onClose,
}: DeckyPluginViewProps): SetupView {
  const textView = (paragraphs: string[], footer = closeFooter(onClose)) =>
    setupView(t('deckySetup.title'), <SetupText paragraphs={paragraphs} />, footer);

  if (!state) {
    return setupView(
      t('deckySetup.title'),
      <SetupProgress text={t('common.checkingSystem')} percent={null} />,
      closeFooter(onClose)
    );
  }

  const offer = deckyOffer(state);
  switch (offer.kind) {
    case 'no-decky':
      return textView(
        [t('deckySetup.noDecky')],
        <SetupFooter>
          {deckySiteButton(true)}
          <SetupCloseButton onClose={onClose} />
        </SetupFooter>
      );
    case 'plugin-disabled':
      return textView([t('pluginEntries.deckyPluginDisabled')]);
    case 'plugin-ready':
      return textView([t('deckySetup.pluginReady')]);
    case 'plugin-missing':
    case 'plugin-outdated': {
      const outdated = offer.kind === 'plugin-outdated';
      const intro = outdated
        ? [t('deckySetup.pluginUpdate'), t('deckySetup.intro')]
        : [t('deckySetup.intro')];
      return textView(
        loaderInstalled ? [t('deckySetup.loaderDone'), ...intro] : intro,
        <SetupFooter>
          <SetupButton
            tone="primary"
            onClick={onRequest}
            busy={isRequesting}
            disabled={state.busy}
            gamepad="confirm"
            icon={
              outdated && requestPhase === 'idle' ? (
                <CircleArrowUpIcon size={16} />
              ) : (
                <AppActionIcon
                  phase={requestPhase}
                  icon={Download}
                  size={16}
                  inheritColor
                />
              )
            }
          >
            {outdated ? t('deckySetup.updatePlugin') : t('deckySetup.installPlugin')}
          </SetupButton>
          <OfferDismissButtons
            source={source}
            onClose={onClose}
            onDecline={outdated ? undefined : onDecline}
          />
        </SetupFooter>
      );
    }
  }
}
