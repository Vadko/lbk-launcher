import { Download } from 'lucide';
import { CircleArrowUpIcon, ExternalLinkIcon } from 'lucide-react';
import React from 'react';
import type { ActionPhase } from '@/renderer/hooks/useActionPhase';
import type { PluginHostState } from '@/shared/plugin-host-types';
import type { SteamPluginSetupSource } from '../../../../store/useSteamPluginSetupStore';
import { deckyOffer } from '../../../../utils/pluginHostOffer';
import { openDeckySite } from '../../../../utils/steamPluginHost';
import { AppActionIcon } from '../../../ui/AppActionIcon';
import {
  OfferDismissButtons,
  SetupButton,
  SetupCloseButton,
  SetupFooter,
  SetupFrame,
  SetupProgress,
  SetupText,
} from '../SetupParts';
import { DECKY_TITLE } from './DeckyLoaderStep';

const INTRO_TEXT =
  'Плагін показує в Steam перекладені досягнення — у бібліотеці, сповіщеннях і оверлеї. Усе інше лаунчер уміє й без нього. Decky Loader покаже запит на встановлення — підтвердьте його в Steam.';
const NO_DECKY_TEXT =
  'Decky Loader не знайдено. Спершу встановіть Decky Loader — після цього лаунчер зможе додати до нього плагін «LBK Bridge».';
const DISABLED_TEXT =
  'Плагін «LBK Bridge» вимкнено в Decky Loader. Увімкніть його в налаштуваннях Decky.';
const LOADER_DONE_TEXT = 'Decky Loader встановлено.';

interface DeckyPluginStepProps {
  state: PluginHostState | null;
  source: SteamPluginSetupSource;
  loaderInstalled: boolean;
  requestPhase: ActionPhase;
  isRequesting: boolean;
  onRequest: () => void;
  onDecline: () => void;
  onClose: () => void;
}

export const DeckyPluginStep: React.FC<DeckyPluginStepProps> = ({
  state,
  source,
  loaderInstalled,
  requestPhase,
  isRequesting,
  onRequest,
  onDecline,
  onClose,
}): React.ReactElement => {
  const frame = (paragraphs: string[], footer: React.ReactNode) => (
    <SetupFrame title={DECKY_TITLE} dismissable onClose={onClose} footer={footer}>
      <SetupText paragraphs={paragraphs} />
    </SetupFrame>
  );
  const closeFooter = (
    <SetupFooter>
      <SetupCloseButton onClose={onClose} />
    </SetupFooter>
  );

  if (!state) {
    return (
      <SetupFrame title={DECKY_TITLE} dismissable onClose={onClose} footer={closeFooter}>
        <SetupProgress text="Перевірка системи…" percent={null} />
      </SetupFrame>
    );
  }

  const offer = deckyOffer(state);
  switch (offer.kind) {
    case 'no-decky':
      return frame(
        [NO_DECKY_TEXT],
        <SetupFooter>
          <SetupButton
            tone="primary"
            onClick={openDeckySite}
            gamepad="confirm"
            icon={<ExternalLinkIcon size={16} />}
          >
            Що таке Decky Loader
          </SetupButton>
          <SetupCloseButton onClose={onClose} />
        </SetupFooter>
      );
    case 'plugin-disabled':
      return frame([DISABLED_TEXT], closeFooter);
    case 'plugin-ready':
      return frame(
        ['Плагін «LBK Bridge» для Decky Loader уже встановлено.'],
        closeFooter
      );
    case 'plugin-missing':
    case 'plugin-outdated': {
      const outdated = offer.kind === 'plugin-outdated';
      const intro = outdated
        ? ['Доступне оновлення плагіна «LBK Bridge» для Decky.', INTRO_TEXT]
        : [INTRO_TEXT];
      return frame(
        loaderInstalled ? [LOADER_DONE_TEXT, ...intro] : intro,
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
            {outdated ? 'Оновити плагін для Decky' : 'Встановити плагін'}
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
};
