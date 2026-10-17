import { CheckIcon, RotateCwIcon, Trash2Icon } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSteamPluginHost } from '@/renderer/hooks/useSteamPluginHost';
import type { MillenniumInstallResult } from '@/shared/types';
import { useSteamPluginSetupStore } from '../../../store/useSteamPluginSetupStore';
import { restartFailureMessage } from '../../../utils/steamBridge';
import {
  millenniumPhaseText,
  steamRunningBeforeChange,
} from '../../../utils/steamPluginHost';
import {
  SetupButton,
  SetupFooter,
  SetupFrame,
  SetupProgress,
  SetupText,
} from './SetupParts';

const QUEUED_TEXT = 'Millennium буде видалено, щойно ви закриєте Steam.';

type Step =
  | { kind: 'confirm' }
  | { kind: 'confirm-restart' }
  | { kind: 'working'; text: string }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string };

function outcomeStep(result: MillenniumInstallResult | null): Step {
  if (result?.success) {
    return {
      kind: 'done',
      message: result.queued ? QUEUED_TEXT : 'Millennium видалено.',
    };
  }
  if (result?.reason === 'files-locked') {
    return {
      kind: 'done',
      message:
        'Файли Steam ще зайняті. Millennium буде видалено після наступного закриття Steam.',
    };
  }
  if (result?.reason === 'restart-failed') {
    const text = restartFailureMessage(result.restartReason, result.error, false);
    return { kind: 'error', message: result.queued ? `${text}\n\n${QUEUED_TEXT}` : text };
  }
  return {
    kind: 'error',
    message: result?.error
      ? `Не вдалося видалити Millennium: ${result.error}`
      : 'Не вдалося видалити Millennium.',
  };
}

export const MillenniumUninstallFlow: React.FC = () => {
  const close = useSteamPluginSetupStore((s) => s.close);
  const { state } = useSteamPluginHost(true);
  const [step, setStep] = useState<Step>({ kind: 'confirm' });
  const [purge, setPurge] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(
    () =>
      window.electronAPI.onMillenniumProgress((progress) => {
        setStep((current) =>
          current.kind === 'working'
            ? { kind: 'working', text: millenniumPhaseText(progress.phase, 'uninstall') }
            : current
        );
      }),
    []
  );

  const run = useCallback(
    async (restart: 'now' | 'on-exit') => {
      setStep({ kind: 'working', text: 'Видалення Millennium…' });
      const result = await window.electronAPI
        .uninstallMillennium({ purge, restart })
        .catch((error: unknown) => {
          console.error('[MillenniumSetup] Uninstall failed:', error);
          return null;
        });
      if (aliveRef.current) {
        setStep(outcomeStep(result));
      }
    },
    [purge]
  );

  const handleConfirm = useCallback(async () => {
    const fresh = await window.electronAPI.getPluginHostState().catch(() => null);
    if (!aliveRef.current) {
      return;
    }
    if (steamRunningBeforeChange(fresh?.steamRunning, state?.steamRunning)) {
      setStep({ kind: 'confirm-restart' });
      return;
    }
    void run('now');
  }, [run, state]);

  const busy = !state || state.busy;
  let body: React.ReactNode;
  let footer: React.ReactNode;
  let dismissable = true;

  switch (step.kind) {
    case 'confirm':
      body = (
        <div className="flex flex-col gap-4">
          <SetupText
            paragraphs={[
              'Millennium буде видалено з теки Steam. Плагіни й теми Millennium залишаться, якщо не позначити «Видалити також плагіни й налаштування Millennium».',
            ]}
          />
          <button
            type="button"
            role="checkbox"
            aria-checked={purge}
            onClick={() => setPurge((value) => !value)}
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
            <span className="min-w-0">
              Видалити також плагіни й налаштування Millennium
            </span>
          </button>
        </div>
      );
      footer = (
        <SetupFooter>
          <SetupButton
            tone="danger"
            onClick={() => void handleConfirm()}
            disabled={busy}
            gamepad="confirm"
            icon={<Trash2Icon size={16} />}
          >
            Видалити Millennium
          </SetupButton>
          <SetupButton tone="secondary" onClick={close} gamepad="cancel">
            Скасувати
          </SetupButton>
        </SetupFooter>
      );
      break;
    case 'confirm-restart': {
      const canRestart = state?.canRestartSteam === true;
      body = (
        <SetupText
          paragraphs={[
            'Щоб видалити Millennium, Steam потрібно закрити й запустити знову.',
            ...(canRestart
              ? []
              : [
                  'Лаунчер не може перезапустити Steam зараз. Закрийте Steam самостійно.',
                ]),
          ]}
        />
      );
      footer = (
        <SetupFooter>
          {canRestart && (
            <SetupButton
              tone="primary"
              onClick={() => void run('now')}
              gamepad="confirm"
              icon={<RotateCwIcon size={16} />}
            >
              Перезапустити Steam зараз
            </SetupButton>
          )}
          <SetupButton
            tone={canRestart ? 'secondary' : 'primary'}
            onClick={() => void run('on-exit')}
            gamepad={canRestart ? undefined : 'confirm'}
          >
            Після закриття Steam
          </SetupButton>
        </SetupFooter>
      );
      break;
    }
    case 'working':
      dismissable = false;
      body = <SetupProgress text={step.text} percent={null} />;
      footer = null;
      break;
    case 'done':
    case 'error':
      body = <SetupText paragraphs={[step.message]} />;
      footer = (
        <SetupFooter>
          <SetupButton
            tone={step.kind === 'done' ? 'primary' : 'secondary'}
            onClick={close}
            gamepad="confirm"
          >
            {step.kind === 'done' ? 'Зрозуміло' : 'Закрити'}
          </SetupButton>
        </SetupFooter>
      );
      break;
  }

  return (
    <SetupFrame
      title="Видалення Millennium"
      dismissable={dismissable}
      onClose={close}
      footer={footer}
    >
      {body}
    </SetupFrame>
  );
};
