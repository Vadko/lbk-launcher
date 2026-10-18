import { useMachine } from '@xstate/react';
import { RefreshCw } from 'lucide';
import { ExternalLinkIcon, PlayIcon, RotateCwIcon, Trash2Icon } from 'lucide-react';
import React, { useCallback, useEffect } from 'react';
import { fromPromise } from 'xstate';
import { useActionPhase } from '@/renderer/hooks/useActionPhase';
import { useSteamPluginHost } from '@/renderer/hooks/useSteamPluginHost';
import { useSettingsStore } from '@/renderer/store/useSettingsStore';
import { useSteamPluginSetupStore } from '@/renderer/store/useSteamPluginSetupStore';
import { openMillenniumSite } from '@/renderer/utils/steamBridge';
import { millenniumPhaseText } from '@/renderer/utils/steamPluginHost';
import type { SteamBridgeStatus } from '@/shared/plugin-host-types';
import { AppActionIcon } from '../../ui/AppActionIcon';
import { millenniumInstallMachine } from './millenniumInstallMachine';
import type { ErrorActions } from './millenniumSetup';
import {
  SetupButton,
  SetupCloseButton,
  SetupDoneButton,
  SetupFooter,
  SetupFrame,
  SetupProgress,
} from './SetupParts';
import { MILLENNIUM_TITLE, MillenniumIntro } from './steps/MillenniumIntro';
import { RestartChoiceStep } from './steps/RestartChoiceStep';
import { ResultStep } from './steps/ResultStep';
import { WaitingPluginStep } from './steps/WaitingPluginStep';

const isConnected = (status: SteamBridgeStatus | null): boolean =>
  status?.millennium.plugin.connected === true;

export const MillenniumInstallFlow: React.FC = () => {
  const close = useSteamPluginSetupStore((s) => s.close);
  const source = useSteamPluginSetupStore((s) => s.source);
  const openSetup = useSteamPluginSetupStore((s) => s.openSetup);
  const declineOffer = useSettingsStore((s) => s.declineMillenniumOffer);
  const state = useSteamPluginHost(true);
  const {
    phase: recheckPhase,
    isPending: isRechecking,
    run: runRecheck,
  } = useActionPhase();
  const [snapshot, send] = useMachine(
    millenniumInstallMachine.provide({
      actors: {
        recheck: fromPromise(() =>
          runRecheck(() => window.electronAPI.recheckSteamBridge(), {
            isSuccess: isConnected,
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

  const install = () => send({ type: 'INSTALL' });
  const restartSteam = () => send({ type: 'RESTART_STEAM' });
  const { work, restartChoice, result } = snapshot.context;

  if (snapshot.matches('intro')) {
    return (
      <MillenniumIntro
        state={state}
        source={source}
        onInstall={install}
        onRestartSteam={restartSteam}
        onDecline={handleDecline}
        onClose={close}
      />
    );
  }
  if (snapshot.matches('working')) {
    return (
      <SetupFrame
        title={MILLENNIUM_TITLE}
        dismissable={false}
        onClose={close}
        footer={
          work.cancellable ? (
            <SetupFooter>
              <SetupButton
                tone="secondary"
                onClick={() => void window.electronAPI.cancelMillennium()}
                gamepad="cancel"
              >
                Скасувати
              </SetupButton>
            </SetupFooter>
          ) : null
        }
      >
        <SetupProgress text={work.text} percent={work.percent} />
      </SetupFrame>
    );
  }
  if (snapshot.matches('confirmRestart')) {
    return (
      <RestartChoiceStep
        title={MILLENNIUM_TITLE}
        paragraphs={[
          'Щоб завершити встановлення, Steam потрібно закрити й запустити знову.',
          ...(restartChoice.note ? [restartChoice.note] : []),
        ]}
        canRestart={restartChoice.canRestart}
        onChoose={(restart) => send({ type: 'ACTIVATE', restart })}
        onClose={close}
        cancellable
      />
    );
  }
  if (snapshot.matches('waitingPlugin')) {
    return (
      <WaitingPluginStep
        title={MILLENNIUM_TITLE}
        text={millenniumPhaseText('wait-plugin', 'install')}
        onClose={close}
      />
    );
  }
  if (result.kind === 'done') {
    return (
      <ResultStep title={MILLENNIUM_TITLE} paragraphs={result.paragraphs} onClose={close}>
        <SetupDoneButton onClose={close} />
      </ResultStep>
    );
  }

  const errorButtons: Record<ErrorActions, React.ReactNode> = {
    retry: (
      <SetupButton
        tone="primary"
        onClick={install}
        gamepad="confirm"
        icon={<RotateCwIcon size={16} />}
      >
        Спробувати ще раз
      </SetupButton>
    ),
    site: (
      <SetupButton
        tone="primary"
        onClick={openMillenniumSite}
        gamepad="confirm"
        icon={<ExternalLinkIcon size={16} />}
      >
        Відкрити сайт Millennium
      </SetupButton>
    ),
    'steam-not-back': (
      <>
        <SetupButton
          tone="primary"
          onClick={restartSteam}
          gamepad="confirm"
          icon={<PlayIcon size={16} />}
        >
          Запустити Steam
        </SetupButton>
        <SetupButton
          tone="danger"
          onClick={() => openSetup('millennium-uninstall', source)}
          icon={<Trash2Icon size={16} />}
        >
          Видалити Millennium
        </SetupButton>
      </>
    ),
    'env-missing': (
      <SetupButton
        tone="primary"
        onClick={restartSteam}
        gamepad="confirm"
        icon={<RotateCwIcon size={16} />}
      >
        Перезапустити Steam
      </SetupButton>
    ),
    recheck: (
      <SetupButton
        tone="primary"
        onClick={() => send({ type: 'RECHECK' })}
        busy={isRechecking}
        gamepad="confirm"
        icon={
          <AppActionIcon phase={recheckPhase} icon={RefreshCw} size={16} inheritColor />
        }
      >
        Перевірити ще раз
      </SetupButton>
    ),
    none: null,
  };

  return (
    <ResultStep title={MILLENNIUM_TITLE} paragraphs={[result.message]} onClose={close}>
      {errorButtons[result.actions]}
      <SetupCloseButton onClose={close} />
    </ResultStep>
  );
};
