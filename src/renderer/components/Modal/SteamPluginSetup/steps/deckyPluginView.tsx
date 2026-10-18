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
  SetupProgress,
  SetupText,
  type SetupView,
} from '../SetupParts';
import { DECKY_TITLE } from './deckyLoaderView';

const INTRO_TEXT =
  'Плагін показує в Steam перекладені досягнення — у бібліотеці, сповіщеннях і оверлеї. Усе інше лаунчер уміє й без нього. Decky Loader покаже запит на встановлення — підтвердьте його в Steam.';
const NO_DECKY_TEXT =
  'Decky Loader не знайдено. Спершу встановіть Decky Loader — після цього лаунчер зможе додати до нього плагін «LBK Bridge».';
const DISABLED_TEXT =
  'Плагін «LBK Bridge» вимкнено в Decky Loader. Увімкніть його в налаштуваннях Decky.';
const LOADER_DONE_TEXT = 'Decky Loader встановлено.';

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
  const view = (body: React.ReactNode, footer: React.ReactNode): SetupView => ({
    title: DECKY_TITLE,
    dismissable: true,
    body,
    footer,
  });
  const textView = (paragraphs: string[], footer: React.ReactNode) =>
    view(<SetupText paragraphs={paragraphs} />, footer);
  const closeFooter = (
    <SetupFooter>
      <SetupCloseButton onClose={onClose} />
    </SetupFooter>
  );

  if (!state) {
    return view(<SetupProgress text="Перевірка системи…" percent={null} />, closeFooter);
  }

  const offer = deckyOffer(state);
  switch (offer.kind) {
    case 'no-decky':
      return textView(
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
      return textView([DISABLED_TEXT], closeFooter);
    case 'plugin-ready':
      return textView(
        ['Плагін «LBK Bridge» для Decky Loader уже встановлено.'],
        closeFooter
      );
    case 'plugin-missing':
    case 'plugin-outdated': {
      const outdated = offer.kind === 'plugin-outdated';
      const intro = outdated
        ? ['Доступне оновлення плагіна «LBK Bridge» для Decky.', INTRO_TEXT]
        : [INTRO_TEXT];
      return textView(
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
}
