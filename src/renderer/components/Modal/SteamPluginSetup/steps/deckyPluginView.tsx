import { Download } from 'lucide';
import { CircleArrowUpIcon } from 'lucide-react';
import type { ActionPhase } from '@/renderer/hooks/useActionPhase';
import type { PluginHostState } from '@/shared/plugin-host-types';
import type { SteamPluginSetupSource } from '../../../../store/useSteamPluginSetupStore';
import { DECKY_PLUGIN_DISABLED_TEXT } from '../../../../utils/pluginHostEntries';
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
import { DECKY_TITLE, deckySiteButton } from './deckyLoaderView';
import { closeFooter, setupView } from './setupView';

const INTRO_TEXT =
  'Плагін показує в Steam перекладені досягнення — у бібліотеці, сповіщеннях і оверлеї. Усе інше лаунчер уміє й без нього. Decky Loader покаже запит на встановлення — підтвердьте його в Steam.';
const NO_DECKY_TEXT =
  'Decky Loader не знайдено. Спершу встановіть Decky Loader — після цього лаунчер зможе додати до нього плагін «LBK Bridge».';
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
  const textView = (paragraphs: string[], footer = closeFooter(onClose)) =>
    setupView(DECKY_TITLE, <SetupText paragraphs={paragraphs} />, footer);

  if (!state) {
    return setupView(
      DECKY_TITLE,
      <SetupProgress text="Перевірка системи…" percent={null} />,
      closeFooter(onClose)
    );
  }

  const offer = deckyOffer(state);
  switch (offer.kind) {
    case 'no-decky':
      return textView(
        [NO_DECKY_TEXT],
        <SetupFooter>
          {deckySiteButton(true)}
          <SetupCloseButton onClose={onClose} />
        </SetupFooter>
      );
    case 'plugin-disabled':
      return textView([DECKY_PLUGIN_DISABLED_TEXT]);
    case 'plugin-ready':
      return textView(['Плагін «LBK Bridge» для Decky Loader уже встановлено.']);
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
