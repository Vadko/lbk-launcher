import { Download, Save } from 'lucide';
import { CircleArrowUpIcon, ExternalLinkIcon } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useActionPhase } from '@/renderer/hooks/useActionPhase';
import { useSteamPluginHost } from '@/renderer/hooks/useSteamPluginHost';
import type { DeckyInstallResult, PluginHostState } from '@/shared/types';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { useSteamPluginSetupStore } from '../../../store/useSteamPluginSetupStore';
import { openDeckySite } from '../../../utils/steamPluginHost';
import { AppActionIcon } from '../../ui/AppActionIcon';
import {
  SetupButton,
  SetupFooter,
  SetupFrame,
  SetupProgress,
  SetupText,
} from './SetupParts';

const SAVE_ZIP_AFTER_MS = 30_000;
const WAIT_MS = 5 * 60 * 1000;
const POLL_MS = 3000;

const INTRO_TEXT =
  'Плагін показує в Steam перекладені досягнення — у бібліотеці, сповіщеннях і оверлеї. Усе інше лаунчер уміє й без нього. Decky Loader покаже запит на встановлення — підтвердьте його в Steam.';
const WAITING_TEXT =
  'Підтвердіть встановлення плагіна «LBK Bridge» у вікні Decky Loader. Якщо вікна не видно, натисніть кнопку Steam.';
const FALLBACK_TEXT =
  'Не вдалося відкрити запит Decky Loader. Збережіть плагін і встановіть його вручну: Decky → Налаштування → Розробник → Install Plugin from ZIP.';
const DONE_TEXT =
  "Плагін «LBK Bridge» встановлено. Переклад досягнень з'явиться в Steam.";
const NO_DECKY_TEXT =
  'Decky Loader не знайдено. Спершу встановіть Decky Loader — після цього лаунчер зможе додати до нього плагін «LBK Bridge».';
const DISABLED_TEXT =
  'Плагін «LBK Bridge» вимкнено в Decky Loader. Увімкніть його в налаштуваннях Decky.';

type Step =
  | { kind: 'intro' }
  | { kind: 'waiting'; startedAt: number }
  | { kind: 'fallback' }
  | { kind: 'done' };

function pluginReady(state: PluginHostState | null): boolean {
  const plugin = state?.decky?.plugin;
  return plugin?.installed === true && !plugin.outdated;
}

export const DeckyPluginSetupFlow: React.FC = () => {
  const close = useSteamPluginSetupStore((s) => s.close);
  const source = useSteamPluginSetupStore((s) => s.source);
  const declineOffer = useSettingsStore((s) => s.declineDeckyPluginOffer);
  const { state, refresh } = useSteamPluginHost(true);
  const [step, setStep] = useState<Step>({ kind: 'intro' });
  const [showSaveZip, setShowSaveZip] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const aliveRef = useRef(true);
  const {
    phase: requestPhase,
    isPending: isRequesting,
    run: runRequest,
  } = useActionPhase();
  const { phase: savePhase, isPending: isSaving, run: runSave } = useActionPhase();

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // The plugin dir appearing is the only success signal: Decky's install call returns before the user confirms.
  const view: Step =
    step.kind === 'waiting' && pluginReady(state) ? { kind: 'done' } : step;
  const startedAt = view.kind === 'waiting' ? view.startedAt : null;
  useEffect(() => {
    if (startedAt === null) {
      return;
    }
    const saveTimer = setTimeout(
      () => setShowSaveZip(true),
      Math.max(0, startedAt + SAVE_ZIP_AFTER_MS - Date.now())
    );
    const pollTimer = setInterval(() => {
      if (Date.now() >= startedAt + WAIT_MS) {
        setStep({ kind: 'fallback' });
        return;
      }
      void refresh();
    }, POLL_MS);
    return () => {
      clearTimeout(saveTimer);
      clearInterval(pollTimer);
    };
  }, [startedAt, refresh]);

  const handleRequest = useCallback(async () => {
    if (isRequesting) {
      return;
    }
    let result: DeckyInstallResult;
    try {
      result = await runRequest(() => window.electronAPI.requestDeckyPluginInstall(), {
        isSuccess: (r) => r.success,
      });
    } catch (error) {
      console.warn('[DeckySetup] Install request failed:', error);
      result = { success: false, reason: 'failed' };
    }
    if (!aliveRef.current) {
      return;
    }
    if (result.success) {
      setStep(
        result.state === 'installed'
          ? { kind: 'done' }
          : { kind: 'waiting', startedAt: Date.now() }
      );
      return;
    }
    if (result.reason === 'no-decky') {
      await refresh();
      setStep({ kind: 'intro' });
      return;
    }
    setStep({ kind: 'fallback' });
  }, [isRequesting, refresh, runRequest]);

  const handleSaveZip = useCallback(async () => {
    if (isSaving) {
      return;
    }
    try {
      const result = await runSave(() => window.electronAPI.saveDeckyPluginZip(), {
        isSuccess: (r) => r.success,
      });
      if (aliveRef.current) {
        setSavedMessage(
          result.success && result.path
            ? `Файл збережено: ${result.path}`
            : `Не вдалося зберегти файл${result.error ? `: ${result.error}` : '.'}`
        );
      }
    } catch (error) {
      console.warn('[DeckySetup] Saving the zip failed:', error);
    }
  }, [isSaving, runSave]);

  const handleDecline = useCallback(() => {
    declineOffer();
    close();
  }, [close, declineOffer]);

  const decky = state?.decky ?? null;
  const outdated = decky?.plugin.installed === true && decky.plugin.outdated;
  const saveZipButton = (
    <SetupButton
      tone={view.kind === 'fallback' ? 'primary' : 'secondary'}
      onClick={() => void handleSaveZip()}
      busy={isSaving}
      gamepad={view.kind === 'fallback' ? 'confirm' : undefined}
      icon={<AppActionIcon phase={savePhase} icon={Save} size={16} inheritColor />}
    >
      Зберегти ZIP
    </SetupButton>
  );
  const closeButton = (
    <SetupButton tone="secondary" onClick={close} gamepad="cancel">
      Закрити
    </SetupButton>
  );
  const savedNote = savedMessage ? (
    <p className="mt-3 text-sm text-text-main wrap-break-word">{savedMessage}</p>
  ) : null;

  let body: React.ReactNode;
  let footer: React.ReactNode;

  switch (view.kind) {
    case 'intro': {
      if (!state) {
        body = <SetupProgress text="Перевірка системи…" percent={null} />;
        footer = <SetupFooter>{closeButton}</SetupFooter>;
        break;
      }
      if (!decky?.installed) {
        body = <SetupText paragraphs={[NO_DECKY_TEXT]} />;
        footer = (
          <SetupFooter>
            <SetupButton
              tone="primary"
              onClick={openDeckySite}
              gamepad="confirm"
              icon={<ExternalLinkIcon size={16} />}
            >
              Що таке Decky Loader
            </SetupButton>
            {closeButton}
          </SetupFooter>
        );
        break;
      }
      if (decky.plugin.installed && decky.plugin.disabled) {
        body = <SetupText paragraphs={[DISABLED_TEXT]} />;
        footer = <SetupFooter>{closeButton}</SetupFooter>;
        break;
      }
      if (pluginReady(state)) {
        body = (
          <SetupText
            paragraphs={['Плагін «LBK Bridge» для Decky Loader уже встановлено.']}
          />
        );
        footer = <SetupFooter>{closeButton}</SetupFooter>;
        break;
      }
      body = (
        <SetupText
          paragraphs={
            outdated
              ? ['Доступне оновлення плагіна «LBK Bridge» для Decky.', INTRO_TEXT]
              : [INTRO_TEXT]
          }
        />
      );
      footer = (
        <SetupFooter>
          <SetupButton
            tone="primary"
            onClick={() => void handleRequest()}
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
          <SetupButton tone="secondary" onClick={close} gamepad="cancel">
            {source === 'offer' ? 'Не зараз' : 'Скасувати'}
          </SetupButton>
          {source === 'offer' && !outdated && (
            <SetupButton tone="secondary" onClick={handleDecline}>
              Більше не пропонувати
            </SetupButton>
          )}
        </SetupFooter>
      );
      break;
    }
    case 'waiting':
      body = (
        <>
          <SetupProgress text={WAITING_TEXT} percent={null} />
          {savedNote}
        </>
      );
      footer = (
        <SetupFooter>
          {showSaveZip && saveZipButton}
          {closeButton}
        </SetupFooter>
      );
      break;
    case 'fallback':
      body = (
        <>
          <SetupText paragraphs={[FALLBACK_TEXT]} />
          {savedNote}
        </>
      );
      footer = (
        <SetupFooter>
          {saveZipButton}
          {closeButton}
        </SetupFooter>
      );
      break;
    case 'done':
      body = <SetupText paragraphs={[DONE_TEXT]} />;
      footer = (
        <SetupFooter>
          <SetupButton tone="primary" onClick={close} gamepad="confirm">
            Зрозуміло
          </SetupButton>
        </SetupFooter>
      );
      break;
  }

  return (
    <SetupFrame
      title="Плагін «LBK Bridge» для Decky Loader"
      dismissable
      onClose={close}
      footer={footer}
    >
      {body}
    </SetupFrame>
  );
};
