import { useMachine } from '@xstate/react';
import { CheckIcon, Trash2Icon } from 'lucide-react';
import React from 'react';
import { useSteamPluginHost } from '@/renderer/hooks/useSteamPluginHost';
import { useSteamPluginSetupStore } from '@/renderer/store/useSteamPluginSetupStore';
import { t } from '@/shared/i18n/i18n';
import { millenniumUninstallMachine } from './millenniumUninstallMachine';
import {
  SetupButton,
  SetupFooter,
  SetupFrame,
  SetupProgress,
  SetupText,
  type SetupView,
} from './SetupParts';
import { restartChoiceView } from './steps/restartChoiceView';
import { resultView, setupView } from './steps/setupView';

export const MillenniumUninstallFlow: React.FC = () => {
  const close = useSteamPluginSetupStore((s) => s.close);
  const state = useSteamPluginHost(true);
  const [snapshot, send] = useMachine(millenniumUninstallMachine);
  const { purge, text, result } = snapshot.context;

  const stepView = (): SetupView => {
    if (snapshot.matches('confirmRestart')) {
      const canRestart = state?.canRestartSteam === true;
      return restartChoiceView({
        title: t('millenniumUninstall.title'),
        paragraphs: [
          t('millenniumUninstall.restartNeeded'),
          ...(canRestart ? [] : [t('millenniumUninstall.cannotRestart')]),
        ],
        canRestart,
        onChoose: (restart) => send({ type: 'CHOOSE', restart }),
        onClose: close,
        cancellable: false,
      });
    }
    if (snapshot.matches('uninstalling')) {
      return {
        title: t('millenniumUninstall.title'),
        dismissable: false,
        body: <SetupProgress text={text} percent={null} />,
        footer: null,
      };
    }
    if (snapshot.matches('result')) {
      const done = result.kind === 'done';
      return resultView({
        title: t('millenniumUninstall.title'),
        paragraphs: [result.message],
        buttons: (
          <SetupButton
            tone={done ? 'primary' : 'secondary'}
            onClick={close}
            gamepad="confirm"
          >
            {done ? t('common.ok') : t('common.close')}
          </SetupButton>
        ),
      });
    }
    return setupView(
      t('millenniumUninstall.title'),
      <div className="flex flex-col gap-4">
        <SetupText paragraphs={[t('millenniumUninstall.confirm')]} />
        <button
          type="button"
          role="checkbox"
          aria-checked={purge}
          onClick={() => send({ type: 'TOGGLE_PURGE' })}
          data-gamepad-modal-item
          className="flex items-start gap-3 rounded-xl p-2 text-left text-sm text-text-main hover:bg-glass-hover transition-colors"
        >
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
              purge
                ? 'bg-color-main border-color-main text-text-dark'
                : 'bg-glass border-border'
            }`}
          >
            {purge && <CheckIcon size={14} />}
          </span>
          <span className="min-w-0">{t('millenniumUninstall.purge')}</span>
        </button>
      </div>,
      <SetupFooter>
        <SetupButton
          tone="danger"
          onClick={() => send({ type: 'CONFIRM', steamRunning: state?.steamRunning })}
          disabled={!state || state.busy}
          gamepad="confirm"
          icon={<Trash2Icon size={16} />}
        >
          {t('millenniumUninstall.action')}
        </SetupButton>
        <SetupButton tone="secondary" onClick={close} gamepad="cancel">
          {t('common.cancel')}
        </SetupButton>
      </SetupFooter>
    );
  };

  return <SetupFrame view={stepView()} onClose={close} />;
};
