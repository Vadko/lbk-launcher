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
import {
  SetupButton,
  SetupCloseButton,
  SetupDoneButton,
  SetupFrame,
  SetupProgress,
  type SetupView,
} from './SetupParts';
import { DECKY_TITLE, deckyLoaderView, type LoaderStage } from './steps/deckyLoaderView';
import { deckyPluginView } from './steps/deckyPluginView';
import { resultView } from './steps/setupView';

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
    }),
    { input: { host: state } }
  );

  useEffect(() => {
    send({ type: 'HOST_STATE', state });
  }, [send, state]);

  const handleDecline = useCallback(() => {
    declineOffer();
    close();
  }, [close, declineOffer]);

  const loaderView = (stage: LoaderStage) =>
    deckyLoaderView({
      stage,
      source,
      onInstall: () => send({ type: 'INSTALL_LOADER' }),
      onDecline: handleDecline,
      onClose: close,
    });
  const { loaderInstalled, loaderFailure, showSaveZip, savedMessage } = snapshot.context;
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

  const stepView = (): SetupView => {
    switch (snapshot.value.flow) {
      case 'intro':
      case 'requesting':
      case 'refreshingHost': {
        const loader = state?.deckyLoader;
        if (loader && (!state?.decky?.installed || loader.repair)) {
          return loaderView({
            kind: 'offer',
            repair: loader.repair,
            gameMode: loader.blockedBy === 'game-mode',
          });
        }
        return deckyPluginView({
          state,
          source,
          loaderInstalled,
          requestPhase,
          isRequesting,
          onRequest: () => send({ type: 'REQUEST' }),
          onDecline: handleDecline,
          onClose: close,
        });
      }
      case 'loaderInstalling':
      case 'loaderRunning':
        return loaderView({ kind: 'installing' });
      case 'loaderFailed':
        return loaderView({ kind: 'failed', reason: loaderFailure });
      case 'waiting':
        return resultView({
          title: DECKY_TITLE,
          body: <SetupProgress text={WAITING_TEXT} percent={null} />,
          note: savedMessage,
          buttons: (
            <>
              {showSaveZip && saveZipButton(false)}
              <SetupCloseButton onClose={close} />
            </>
          ),
        });
      case 'fallback':
        return resultView({
          title: DECKY_TITLE,
          paragraphs: [FALLBACK_TEXT],
          note: savedMessage,
          buttons: (
            <>
              {saveZipButton(true)}
              <SetupCloseButton onClose={close} />
            </>
          ),
        });
      case 'done':
        return resultView({
          title: DECKY_TITLE,
          paragraphs: [DONE_TEXT],
          buttons: <SetupDoneButton onClose={close} />,
        });
    }
  };

  return <SetupFrame view={stepView()} onClose={close} />;
};
