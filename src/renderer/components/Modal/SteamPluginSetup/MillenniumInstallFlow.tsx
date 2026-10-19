import { useMachine } from '@xstate/react';
import { RefreshCw } from 'lucide';
import { PlayIcon, RotateCwIcon, Trash2Icon } from 'lucide-react';
import React, { useCallback, useEffect } from 'react';
import { fromPromise } from 'xstate';
import { useActionPhase } from '@/renderer/hooks/useActionPhase';
import { useSteamPluginHost } from '@/renderer/hooks/useSteamPluginHost';
import { useSettingsStore } from '@/renderer/store/useSettingsStore';
import { useSteamPluginSetupStore } from '@/renderer/store/useSteamPluginSetupStore';
import { millenniumPhaseText } from '@/renderer/utils/steamPluginHost';
import { t } from '@/shared/i18n/i18n';
import { AppActionIcon } from '../../ui/AppActionIcon';
import { millenniumInstallMachine } from './millenniumInstallMachine';
import { type ErrorActions, isPluginConnected } from './millenniumSetup';
import {
  SetupButton,
  SetupCloseButton,
  SetupDoneButton,
  SetupFooter,
  SetupFrame,
  SetupProgress,
  type SetupView,
} from './SetupParts';
import { millenniumIntroView, millenniumSiteButton } from './steps/millenniumIntroView';
import { restartChoiceView } from './steps/restartChoiceView';
import { resultView } from './steps/setupView';

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
            isSuccess: isPluginConnected,
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

  const errorButtons = (actions: ErrorActions): React.ReactNode => {
    const buttons: Record<ErrorActions, React.ReactNode> = {
      retry: (
        <SetupButton
          tone="primary"
          onClick={install}
          gamepad="confirm"
          icon={<RotateCwIcon size={16} />}
        >
          {t('common.tryAgain')}
        </SetupButton>
      ),
      site: millenniumSiteButton(),
      'steam-not-back': (
        <>
          <SetupButton
            tone="primary"
            onClick={restartSteam}
            gamepad="confirm"
            icon={<PlayIcon size={16} />}
          >
            {t('millenniumSetup.startSteam')}
          </SetupButton>
          <SetupButton
            tone="danger"
            onClick={() => openSetup('millennium-uninstall', source)}
            icon={<Trash2Icon size={16} />}
          >
            {t('millenniumSetup.uninstall')}
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
          {t('millenniumSetup.restartSteam')}
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
          {t('millenniumSetup.recheck')}
        </SetupButton>
      ),
      none: null,
    };
    return buttons[actions];
  };

  const stepView = (): SetupView => {
    if (snapshot.matches('intro')) {
      return millenniumIntroView({
        state,
        source,
        onInstall: install,
        onRestartSteam: restartSteam,
        onDecline: handleDecline,
        onClose: close,
      });
    }
    if (snapshot.matches('working')) {
      return {
        title: t('millenniumSetup.title'),
        dismissable: false,
        body: <SetupProgress text={work.text} percent={work.percent} />,
        footer: work.cancellable ? (
          <SetupFooter>
            <SetupButton
              tone="secondary"
              onClick={() => void window.electronAPI.cancelMillennium()}
              gamepad="cancel"
            >
              {t('common.cancel')}
            </SetupButton>
          </SetupFooter>
        ) : null,
      };
    }
    if (snapshot.matches('confirmRestart')) {
      return restartChoiceView({
        title: t('millenniumSetup.title'),
        paragraphs: [
          t('millenniumSetup.restartToFinish'),
          ...(restartChoice.note ? [restartChoice.note] : []),
        ],
        canRestart: restartChoice.canRestart,
        onChoose: (restart) => send({ type: 'ACTIVATE', restart }),
        onClose: close,
        cancellable: true,
      });
    }
    if (snapshot.matches('waitingPlugin')) {
      return resultView({
        title: t('millenniumSetup.title'),
        body: (
          <SetupProgress
            text={millenniumPhaseText('wait-plugin', 'install')}
            percent={null}
          />
        ),
        buttons: <SetupCloseButton onClose={close} />,
      });
    }
    if (result.kind === 'done') {
      return resultView({
        title: t('millenniumSetup.title'),
        paragraphs: result.paragraphs,
        buttons: <SetupDoneButton onClose={close} />,
      });
    }
    return resultView({
      title: t('millenniumSetup.title'),
      paragraphs: [result.message],
      buttons: (
        <>
          {errorButtons(result.actions)}
          <SetupCloseButton onClose={close} />
        </>
      ),
    });
  };

  return <SetupFrame view={stepView()} onClose={close} />;
};
