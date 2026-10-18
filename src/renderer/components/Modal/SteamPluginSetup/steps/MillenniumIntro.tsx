import {
  CircleArrowUpIcon,
  DownloadIcon,
  ExternalLinkIcon,
  RotateCwIcon,
  WrenchIcon,
} from 'lucide-react';
import React from 'react';
import type { PluginHostState } from '@/shared/plugin-host-types';
import type { SteamPluginSetupSource } from '../../../../store/useSteamPluginSetupStore';
import { openMillenniumSite } from '../../../../utils/steamBridge';
import { hostOs, millenniumUnsupportedText } from '../../../../utils/steamPluginHost';
import { EXTERNAL_TEXT, introMode, queuedParagraphs } from '../millenniumSetup';
import {
  OfferDismissButtons,
  SetupButton,
  SetupCloseButton,
  SetupFooter,
  SetupFrame,
  SetupProgress,
  SetupText,
} from '../SetupParts';

export const MILLENNIUM_TITLE = 'Millennium і плагін «LBK Bridge»';

function offerParagraphs(): string[] {
  const os = hostOs();
  const paragraphs = [
    'Millennium — безкоштовний сторонній мод клієнта Steam (не від Valve). Лаунчер може встановити його разом із плагіном «LBK Bridge».',
    os === 'macos'
      ? 'Що це дасть:\n• перекладені досягнення в бібліотеці, сповіщеннях і оверлеї Steam.'
      : 'Що це дасть:\n• перекладені досягнення в бібліотеці, сповіщеннях і оверлеї Steam;\n• лаунчер працюватиме зі Steam без відкритого порту налагодження і без запитів перезапустити Steam.',
    'Що працює й без Millennium: параметри запуску, підписки в Майстерні, колекція «З українізаторами», ярлик лаунчера та обкладинки в Steam — через порт налагодження Steam (після одного перезапуску Steam).',
    os === 'macos'
      ? 'Файли завантажуються з нашої збірки Millennium на GitHub.'
      : 'Файли Millennium завантажуються з офіційної сторінки проєкту на GitHub.',
    os === 'windows'
      ? 'Зважте: після оновлень Steam Millennium іноді тимчасово не працює, доки не вийде його оновлення. Антивірус може помилково заблокувати його файли.'
      : 'Зважте: після оновлень Steam Millennium іноді тимчасово не працює, доки не вийде його оновлення.',
  ];
  if (os === 'linux') {
    paragraphs.push(
      'Millennium буде встановлено лише для вашого користувача, без пароля адміністратора. Якщо запускати Steam не з лаунчера, Millennium запрацює після повторного входу в систему.'
    );
  }
  if (os === 'macos') {
    paragraphs.push(
      'На macOS лаунчер встановлює власну збірку Millennium. Вона працює, лише коли Steam запущено через «Steam Millennium» у теці «Програми» вашого користувача — лаунчер сам запускає Steam саме так.'
    );
  }
  paragraphs.push('Для встановлення Steam потрібно буде закрити й запустити знову.');
  return paragraphs;
}

interface MillenniumIntroProps {
  state: PluginHostState | null;
  source: SteamPluginSetupSource;
  onInstall: () => void;
  onRestartSteam: () => void;
  onDecline: () => void;
  onClose: () => void;
}

export const MillenniumIntro: React.FC<MillenniumIntroProps> = ({
  state,
  source,
  onInstall,
  onRestartSteam,
  onDecline,
  onClose,
}) => {
  const mode = introMode(state);
  const busy = state?.busy === true;
  const frame = (
    body: React.ReactNode,
    footer: React.ReactNode,
    title = MILLENNIUM_TITLE
  ) => (
    <SetupFrame title={title} dismissable onClose={onClose} footer={footer}>
      {body}
    </SetupFrame>
  );

  switch (mode) {
    case 'loading':
      return frame(
        <SetupProgress text="Перевірка системи…" percent={null} />,
        <SetupFooter>
          <SetupCloseButton onClose={onClose} />
        </SetupFooter>
      );
    case 'unsupported':
    case 'external': {
      const reason = state?.millennium.unsupportedReason ?? null;
      return frame(
        <SetupText
          paragraphs={[
            mode === 'external' ? EXTERNAL_TEXT : millenniumUnsupportedText(reason),
          ]}
        />,
        <SetupFooter>
          {mode === 'unsupported' && reason === 'millennium-v2' && (
            <SetupButton
              tone="primary"
              onClick={openMillenniumSite}
              gamepad="confirm"
              icon={<ExternalLinkIcon size={16} />}
            >
              Відкрити сайт Millennium
            </SetupButton>
          )}
          <SetupCloseButton onClose={onClose} />
        </SetupFooter>
      );
    }
    case 'pending':
      return frame(
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
              Перезапустити Steam зараз
            </SetupButton>
          )}
          <SetupCloseButton onClose={onClose} />
        </SetupFooter>
      );
    case 'update':
    case 'repair':
      return frame(
        <SetupText
          paragraphs={[
            mode === 'update'
              ? `Доступне оновлення Millennium: ${state?.millennium.update?.version ?? ''}.`
              : 'Файли Millennium у теці Steam пошкоджено або видалено.',
            'Для цього Steam потрібно буде закрити й запустити знову.',
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
            {mode === 'update' ? 'Оновити Millennium' : 'Відновити Millennium'}
          </SetupButton>
          <SetupButton tone="secondary" onClick={onClose} gamepad="cancel">
            Скасувати
          </SetupButton>
        </SetupFooter>,
        mode === 'update' ? 'Оновлення Millennium' : 'Відновлення Millennium'
      );
    case 'offer':
      return frame(
        <SetupText paragraphs={offerParagraphs()} />,
        <SetupFooter>
          <SetupButton
            tone="primary"
            onClick={onInstall}
            disabled={busy}
            gamepad="confirm"
            icon={<DownloadIcon size={16} />}
          >
            Встановити
          </SetupButton>
          <OfferDismissButtons source={source} onClose={onClose} onDecline={onDecline} />
        </SetupFooter>
      );
  }
};
