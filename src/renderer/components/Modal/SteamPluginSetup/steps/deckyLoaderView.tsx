import { DownloadIcon, ExternalLinkIcon } from 'lucide-react';
import React from 'react';
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

export const DECKY_TITLE = 'Плагін «LBK Bridge» для Decky Loader';

const LOADER_OFFER_PARAGRAPHS = [
  'Decky Loader — безкоштовний сторонній завантажувач плагінів для Steam Deck (не від Valve). Лаунчер може встановити його разом із плагіном «LBK Bridge».',
  'Що це дасть:\n• перекладені досягнення в бібліотеці, сповіщеннях і оверлеї Steam.',
  'Що працює й без Decky Loader: параметри запуску, підписки в Майстерні, колекція «З українізаторами», ярлик лаунчера та обкладинки в Steam.',
  'Лаунчер завантажить офіційний інсталятор Decky Loader з GitHub і запустить його. Пароль адміністратора (sudo) інсталятор питає у власному вікні, лаунчер його не бачить. Якщо пароля ще немає, інсталятор запропонує тимчасовий і прибере його після встановлення.',
  'Зважте: після великих оновлень SteamOS Decky Loader іноді доводиться встановити ще раз.',
];
const LOADER_REPAIR_TEXT =
  'Decky Loader встановлено, але він не працює — схоже, попереднє встановлення не завершилося. Лаунчер може запустити офіційний інсталятор Decky Loader ще раз.';
const LOADER_GAME_MODE_TEXT =
  'Інсталятор Decky Loader працює лише в режимі робочого столу. Перейдіть у нього через меню живлення Steam, відкрийте лаунчер і натисніть «Встановити Decky Loader» ще раз.';
const LOADER_INSTALLING_TEXT =
  'Відкрито інсталятор Decky Loader. Введіть пароль адміністратора у вікні «Decky Installer» і оберіть «release». Якщо вікна не видно, знайдіть його на панелі завдань.';

const LOADER_FAILURE_TEXT: Record<LoaderFailure, string> = {
  'game-mode': LOADER_GAME_MODE_TEXT,
  'download-failed':
    "Не вдалося завантажити інсталятор Decky Loader. Перевірте з'єднання з інтернетом і спробуйте ще раз.",
  'checksum-mismatch':
    'Завантажений інсталятор Decky Loader не збігається з перевіреною версією. Встановлення скасовано.',
  unsupported:
    'На цій системі лаунчер не може встановити Decky Loader. Встановіть його за інструкцією на сайті Decky Loader.',
  'not-running':
    'Decky Loader встановлено, але він не запустився. Спробуйте ще раз — інсталятор перевстановить його.',
  'not-installed':
    'Decky Loader не встановлено. Якщо вікно інсталятора закрито або пароль не підійшов, спробуйте ще раз.',
};

const RETRYABLE: ReadonlySet<LoaderFailure> = new Set([
  'not-installed',
  'not-running',
  'download-failed',
]);

type LoaderStage =
  | { kind: 'offer'; repair: boolean; gameMode: boolean }
  | { kind: 'installing' }
  | { kind: 'failed'; reason: LoaderFailure };

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
  const siteButton = (primary: boolean) => (
    <SetupButton
      tone={primary ? 'primary' : 'secondary'}
      onClick={openDeckySite}
      gamepad={primary ? 'confirm' : undefined}
      icon={<ExternalLinkIcon size={16} />}
    >
      Що таке Decky Loader
    </SetupButton>
  );
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
  const view = (body: React.ReactNode, footer: React.ReactNode): SetupView => ({
    title: DECKY_TITLE,
    dismissable: true,
    body,
    footer,
  });

  switch (stage.kind) {
    case 'offer': {
      const offer = stage.repair ? [LOADER_REPAIR_TEXT] : LOADER_OFFER_PARAGRAPHS;
      return view(
        <SetupText
          paragraphs={stage.gameMode ? [...offer, LOADER_GAME_MODE_TEXT] : offer}
        />,
        <SetupFooter>
          {!stage.gameMode &&
            installButton(
              stage.repair ? 'Відновити Decky Loader' : 'Встановити Decky Loader'
            )}
          {siteButton(stage.gameMode)}
          <OfferDismissButtons source={source} onClose={onClose} onDecline={onDecline} />
        </SetupFooter>
      );
    }
    case 'installing':
      return view(
        <SetupProgress text={LOADER_INSTALLING_TEXT} percent={null} />,
        <SetupFooter>
          <SetupCloseButton onClose={onClose} />
        </SetupFooter>
      );
    case 'failed': {
      const retry = RETRYABLE.has(stage.reason);
      return view(
        <SetupText paragraphs={[LOADER_FAILURE_TEXT[stage.reason]]} />,
        <SetupFooter>
          {retry && installButton('Спробувати ще раз')}
          {siteButton(!retry)}
          <SetupCloseButton onClose={onClose} />
        </SetupFooter>
      );
    }
  }
}
