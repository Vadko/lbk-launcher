import { useMachine } from '@xstate/react';
import { Save } from 'lucide';
import React, { useCallback, useEffect } from 'react';
import { fromPromise } from 'xstate';
import { useActionPhase } from '@/renderer/hooks/useActionPhase';
import { useSteamPluginHost } from '@/renderer/hooks/useSteamPluginHost';
import { useSettingsStore } from '@/renderer/store/useSettingsStore';
import { useSteamPluginSetupStore } from '@/renderer/store/useSteamPluginSetupStore';
import { AppActionIcon } from '../../ui/AppActionIcon';
import { deckySetupMachine } from './deckySetupMachine';
import { SetupButton, SetupCloseButton, SetupDoneButton } from './SetupParts';
import { DECKY_TITLE, DeckyLoaderStep } from './steps/DeckyLoaderStep';
import { DeckyPluginStep } from './steps/DeckyPluginStep';
import { ResultStep } from './steps/ResultStep';
import { WaitingPluginStep } from './steps/WaitingPluginStep';

const WAITING_TEXT =
  'Підтвердіть встановлення плагіна «LBK Bridge» у вікні Decky Loader. Якщо вікна не видно, натисніть кнопку Steam.';
const FALLBACK_TEXT =
  'Не вдалося відкрити запит Decky Loader. Збережіть плагін і встановіть його вручну: Decky → Налаштування → Розробник → Install Plugin from ZIP.';
const DONE_TEXT =
  "Плагін «LBK Bridge» встановлено. Переклад досягнень з'явиться в Steam.";

export const DeckyPluginSetupFlow: React.FC = () => {
  const close = useSteamPluginSetupStore((s) => s.close);
  const source = useSteamPluginSetupStore((s) => s.source);
  const declineOffer = useSettingsStore((s) => s.declineDeckyPluginOffer);
  const state = useSteamPluginHost(true);
  const {
    phase: requestPhase,
    isPending: isRequesting,
    run: runRequest,
  } = useActionPhase();
  const { phase: savePhase, isPending: isSaving, run: runSave } = useActionPhase();
  const [snapshot, send] = useMachine(
    deckySetupMachine.provide({
      actors: {
        request: fromPromise(() =>
          runRequest(() => window.electronAPI.requestDeckyPluginInstall(), {
            isSuccess: (r) => r.success,
          })
        ),
        saveZip: fromPromise(() =>
          runSave(() => window.electronAPI.saveDeckyPluginZip(), {
            isSuccess: (r) => r.success,
          })
        ),
      },
    })
  );

  useEffect(() => {
    send({ type: 'HOST_STATE', state });
  }, [send, state]);

  const handleDecline = useCallback(() => {
    declineOffer();
    close();
  }, [close, declineOffer]);

  const installLoader = () => send({ type: 'INSTALL_LOADER' });
  const { loaderInstalled, loaderFailure, showSaveZip, savedMessage } = snapshot.context;
  const flow = snapshot.value.flow;
  const saveZipButton = (primary: boolean) => (
    <SetupButton
      tone={primary ? 'primary' : 'secondary'}
      onClick={() => send({ type: 'SAVE_ZIP' })}
      busy={isSaving}
      gamepad={primary ? 'confirm' : undefined}
      icon={<AppActionIcon phase={savePhase} icon={Save} size={16} inheritColor />}
    >
      Зберегти ZIP
    </SetupButton>
  );

  switch (flow) {
    case 'intro':
    case 'requesting': {
      const loader = state?.deckyLoader;
      if (loader && (!state?.decky?.installed || loader.repair)) {
        return (
          <DeckyLoaderStep
            stage={{
              kind: 'offer',
              repair: loader.repair,
              gameMode: loader.blockedBy === 'game-mode',
            }}
            source={source}
            onInstall={installLoader}
            onDecline={handleDecline}
            onClose={close}
          />
        );
      }
      return (
        <DeckyPluginStep
          state={state}
          source={source}
          loaderInstalled={loaderInstalled}
          requestPhase={requestPhase}
          isRequesting={isRequesting}
          onRequest={() => send({ type: 'REQUEST' })}
          onDecline={handleDecline}
          onClose={close}
        />
      );
    }
    case 'loaderInstalling':
    case 'loaderRunning':
      return (
        <DeckyLoaderStep
          stage={{ kind: 'installing' }}
          source={source}
          onInstall={installLoader}
          onDecline={handleDecline}
          onClose={close}
        />
      );
    case 'loaderFailed':
      return (
        <DeckyLoaderStep
          stage={{ kind: 'failed', reason: loaderFailure }}
          source={source}
          onInstall={installLoader}
          onDecline={handleDecline}
          onClose={close}
        />
      );
    case 'waiting':
      return (
        <WaitingPluginStep
          title={DECKY_TITLE}
          text={WAITING_TEXT}
          note={savedMessage}
          onClose={close}
        >
          {showSaveZip && saveZipButton(false)}
        </WaitingPluginStep>
      );
    case 'fallback':
      return (
        <ResultStep
          title={DECKY_TITLE}
          paragraphs={[FALLBACK_TEXT]}
          note={savedMessage}
          onClose={close}
        >
          {saveZipButton(true)}
          <SetupCloseButton onClose={close} />
        </ResultStep>
      );
    case 'done':
      return (
        <ResultStep title={DECKY_TITLE} paragraphs={[DONE_TEXT]} onClose={close}>
          <SetupDoneButton onClose={close} />
        </ResultStep>
      );
  }
};
