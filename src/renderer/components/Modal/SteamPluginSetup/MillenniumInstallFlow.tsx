import { RefreshCw } from 'lucide';
import {
  CircleArrowUpIcon,
  DownloadIcon,
  ExternalLinkIcon,
  PlayIcon,
  RotateCwIcon,
  Trash2Icon,
  WrenchIcon,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useActionPhase } from '@/renderer/hooks/useActionPhase';
import { useSteamPluginHost } from '@/renderer/hooks/useSteamPluginHost';
import type {
  MillenniumInstallResult,
  PluginHostState,
  RestartFailureReason,
  SteamBridgeStatus,
} from '@/shared/types';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { useSteamPluginSetupStore } from '../../../store/useSteamPluginSetupStore';
import { openMillenniumSite, restartFailureMessage } from '../../../utils/steamBridge';
import {
  hostOs,
  millenniumFailureText,
  millenniumPhaseText,
  millenniumUnsupportedText,
} from '../../../utils/steamPluginHost';
import { AppActionIcon } from '../../ui/AppActionIcon';
import {
  SetupButton,
  SetupFooter,
  SetupFrame,
  SetupProgress,
  SetupText,
} from './SetupParts';

const PLUGIN_WAIT_MS = 120_000;
const PLUGIN_POLL_MS = 2000;

const DONE_TEXT =
  'Millennium встановлено. Steam підключився до лаунчера через плагін «LBK Bridge».';
const QUEUED_TEXT =
  'Millennium встановиться, щойно ви закриєте Steam. Якщо лаунчер на той момент буде закритий — під час його наступного запуску, коли Steam не працюватиме.';
const MAC_QUEUED_TEXT = 'Потім запускайте Steam з лаунчера або через «Steam Millennium».';
const STEAM_NOT_BACK_TEXT =
  'Steam не запустився після встановлення Millennium. Можливо, ця версія Millennium ще не підтримує ваш Steam.';
const ENV_MISSING_TEXT =
  'Steam запущено не з лаунчера, тому Millennium не активний. Перезапустіть Steam з лаунчера або повторно увійдіть у систему.';
const EXTERNAL_TEXT =
  'Millennium уже встановлено — лаунчер сам додасть до нього плагін «LBK Bridge».';

type ErrorActions =
  | 'retry'
  | 'site'
  | 'steam-not-back'
  | 'env-missing'
  | 'recheck'
  | 'none';

type Step =
  | { kind: 'intro' }
  | { kind: 'working'; text: string; percent: number | null; cancellable: boolean }
  | { kind: 'confirm-restart'; canRestart: boolean; note: string | null }
  | { kind: 'waiting-plugin'; deadline: number; envMissing: boolean }
  | { kind: 'done'; paragraphs: string[] }
  | { kind: 'error'; message: string; actions: ErrorActions };

type IntroMode =
  | 'loading'
  | 'offer'
  | 'update'
  | 'repair'
  | 'pending'
  | 'external'
  | 'unsupported';

function introMode(state: PluginHostState | null): IntroMode {
  if (!state) {
    return 'loading';
  }
  const { millennium } = state;
  if (millennium.pending === 'activate') {
    return 'pending';
  }
  if (millennium.installed?.managedBy === 'external') {
    return 'external';
  }
  if (millennium.installed?.managedBy === 'lbk') {
    if (millennium.installed.needsRepair) {
      return 'repair';
    }
    if (millennium.update) {
      return 'update';
    }
    return 'external';
  }
  if (state.host !== 'millennium' || !millennium.supported) {
    return 'unsupported';
  }
  return 'offer';
}

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

function queuedParagraphs(): string[] {
  return hostOs() === 'macos' ? [QUEUED_TEXT, MAC_QUEUED_TEXT] : [QUEUED_TEXT];
}

function restartBlockedNote(status: SteamBridgeStatus | null): string | null {
  let reason: RestartFailureReason | undefined;
  if (status?.steamElevated) {
    reason = 'access-denied';
  } else if (status?.gamescope) {
    reason = 'gamescope';
  }
  return reason ? restartFailureMessage(reason, undefined, false) : null;
}

function isPluginConnected(status: SteamBridgeStatus | null): boolean {
  return status?.millennium.plugin.connected === true;
}

export const MillenniumInstallFlow: React.FC = () => {
  const close = useSteamPluginSetupStore((s) => s.close);
  const source = useSteamPluginSetupStore((s) => s.source);
  const declineOffer = useSettingsStore((s) => s.declineMillenniumOffer);
  const { state } = useSteamPluginHost(true);
  const [step, setStep] = useState<Step>({ kind: 'intro' });
  const steamWasRunningRef = useRef(true);
  const operationRef = useRef<'install' | 'uninstall'>('install');
  const aliveRef = useRef(true);
  const {
    phase: recheckPhase,
    isPending: isRechecking,
    run: runRecheck,
  } = useActionPhase();

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const safeSetStep = useCallback((next: Step) => {
    if (aliveRef.current) {
      setStep(next);
    }
  }, []);

  useEffect(
    () =>
      window.electronAPI.onMillenniumProgress((progress) => {
        setStep((current) =>
          current.kind === 'working'
            ? {
                kind: 'working',
                text: millenniumPhaseText(progress.phase, operationRef.current),
                percent: progress.phase === 'download' ? (progress.percent ?? 0) : null,
                cancellable: progress.phase === 'download',
              }
            : current
        );
      }),
    []
  );

  const failureStep = useCallback(
    (result: MillenniumInstallResult): Step => {
      switch (result.reason) {
        case 'unsupported':
          return {
            kind: 'error',
            message:
              result.error === 'external'
                ? EXTERNAL_TEXT
                : millenniumUnsupportedText(state?.millennium.unsupportedReason ?? null),
            actions: 'none',
          };
        case 'not-writable':
          return {
            kind: 'error',
            message: millenniumFailureText(result.reason),
            actions: 'site',
          };
        case 'conflict':
        case 'busy':
          return {
            kind: 'error',
            message: millenniumFailureText(result.reason),
            actions: 'none',
          };
        case 'files-locked':
          return { kind: 'done', paragraphs: [millenniumFailureText(result.reason)] };
        case 'restart-failed':
          if (result.restartReason === 'launch-failed') {
            return {
              kind: 'error',
              message: STEAM_NOT_BACK_TEXT,
              actions: 'steam-not-back',
            };
          }
          return {
            kind: 'error',
            message: result.queued
              ? `${restartFailureMessage(result.restartReason, result.error, false)}\n\n${QUEUED_TEXT}`
              : restartFailureMessage(result.restartReason, result.error, false),
            actions: 'none',
          };
        default:
          return {
            kind: 'error',
            message: millenniumFailureText(result.reason),
            actions: 'retry',
          };
      }
    },
    [state]
  );

  const activate = useCallback(
    async (restart: 'now' | 'on-exit') => {
      safeSetStep({
        kind: 'working',
        text:
          steamWasRunningRef.current && restart === 'now'
            ? millenniumPhaseText('stop-steam', 'install')
            : millenniumPhaseText('install-files', 'install'),
        percent: null,
        cancellable: false,
      });
      const startedAt = Date.now();
      let result: MillenniumInstallResult;
      try {
        result = await window.electronAPI.activateMillennium({ restart });
      } catch (error) {
        console.error('[MillenniumSetup] Activation failed:', error);
        result = { success: false, reason: 'script-failed' };
      }
      if (!result.success) {
        safeSetStep(failureStep(result));
        return;
      }
      if (result.queued) {
        safeSetStep({ kind: 'done', paragraphs: queuedParagraphs() });
        return;
      }
      if (!steamWasRunningRef.current) {
        safeSetStep({
          kind: 'done',
          paragraphs: [
            'Millennium встановлено. Плагін «LBK Bridge» підключиться, щойно ви запустите Steam.',
          ],
        });
        return;
      }
      safeSetStep({
        kind: 'waiting-plugin',
        deadline: startedAt + PLUGIN_WAIT_MS,
        envMissing: result.diagnostics?.steamEnvMissing === true,
      });
    },
    [failureStep, safeSetStep]
  );

  const startInstall = useCallback(async () => {
    operationRef.current = 'install';
    safeSetStep({
      kind: 'working',
      text: millenniumPhaseText('download', 'install'),
      percent: 0,
      cancellable: true,
    });
    let result: MillenniumInstallResult;
    try {
      result = await window.electronAPI.prepareMillennium();
    } catch (error) {
      console.error('[MillenniumSetup] Prepare failed:', error);
      result = { success: false, reason: 'download-failed' };
    }
    if (!result.success || !result.ready) {
      safeSetStep(failureStep(result));
      return;
    }
    steamWasRunningRef.current = result.steamRunning === true;
    if (result.steamRunning) {
      const canRestart = result.canRestartSteam === true;
      const status = canRestart
        ? null
        : await window.electronAPI.getSteamBridgeStatus().catch(() => null);
      safeSetStep({
        kind: 'confirm-restart',
        canRestart,
        note: canRestart ? null : restartBlockedNote(status),
      });
      return;
    }
    await activate('now');
  }, [activate, failureStep, safeSetStep]);

  const restartSteamAndWait = useCallback(async () => {
    safeSetStep({
      kind: 'working',
      text: millenniumPhaseText('start-steam', 'install'),
      percent: null,
      cancellable: false,
    });
    const startedAt = Date.now();
    const result = await window.electronAPI.restartSteam().catch(() => null);
    if (!result?.success) {
      safeSetStep({
        kind: 'error',
        message:
          result?.reason === 'launch-failed'
            ? STEAM_NOT_BACK_TEXT
            : restartFailureMessage(result?.reason, result?.error, false),
        actions: result?.reason === 'launch-failed' ? 'steam-not-back' : 'none',
      });
      return;
    }
    steamWasRunningRef.current = true;
    safeSetStep({
      kind: 'waiting-plugin',
      deadline: startedAt + PLUGIN_WAIT_MS,
      envMissing: false,
    });
  }, [safeSetStep]);

  const uninstallAfterFailure = useCallback(async () => {
    operationRef.current = 'uninstall';
    safeSetStep({
      kind: 'working',
      text: 'Видалення Millennium…',
      percent: null,
      cancellable: false,
    });
    const result = await window.electronAPI
      .uninstallMillennium({ purge: false, restart: 'now' })
      .catch(() => null);
    if (result?.success) {
      safeSetStep({
        kind: 'done',
        paragraphs: [
          result.queued
            ? 'Millennium буде видалено, щойно ви закриєте Steam.'
            : 'Millennium видалено.',
        ],
      });
      return;
    }
    safeSetStep({
      kind: 'error',
      message: result?.error
        ? `Не вдалося видалити Millennium: ${result.error}`
        : 'Не вдалося видалити Millennium.',
      actions: 'none',
    });
  }, [safeSetStep]);

  const waiting = step.kind === 'waiting-plugin' ? step : null;
  useEffect(() => {
    if (!waiting) {
      return;
    }
    let active = true;
    let steamGoneChecks = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      const status = await window.electronAPI.getSteamBridgeStatus().catch(() => null);
      if (!active) {
        return;
      }
      if (isPluginConnected(status)) {
        setStep({ kind: 'done', paragraphs: [DONE_TEXT] });
        return;
      }
      steamGoneChecks = status?.code === 'steam-not-running' ? steamGoneChecks + 1 : 0;
      // Two misses in a row: one poll can land while Steam swaps its processes during start-up.
      if (steamGoneChecks >= 2) {
        setStep({
          kind: 'error',
          message: STEAM_NOT_BACK_TEXT,
          actions: 'steam-not-back',
        });
        return;
      }
      if (Date.now() >= waiting.deadline) {
        setStep(
          waiting.envMissing
            ? { kind: 'error', message: ENV_MISSING_TEXT, actions: 'env-missing' }
            : {
                kind: 'error',
                message: millenniumFailureText('plugin-not-connected'),
                actions: 'recheck',
              }
        );
        return;
      }
      timer = setTimeout(() => void poll(), PLUGIN_POLL_MS);
    };
    void poll();
    return () => {
      active = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [waiting]);

  const handleRecheck = useCallback(async () => {
    if (isRechecking) {
      return;
    }
    try {
      const status = await runRecheck(() => window.electronAPI.recheckSteamBridge(), {
        isSuccess: isPluginConnected,
      });
      if (isPluginConnected(status)) {
        safeSetStep({ kind: 'done', paragraphs: [DONE_TEXT] });
      }
    } catch (error) {
      console.warn('[MillenniumSetup] Recheck failed:', error);
    }
  }, [isRechecking, runRecheck, safeSetStep]);

  const handleDecline = useCallback(() => {
    declineOffer();
    close();
  }, [close, declineOffer]);

  const handleCancelDownload = useCallback(() => {
    void window.electronAPI.cancelMillennium();
  }, []);

  const mode = introMode(state);
  const busy = state?.busy === true;
  const closeButton = (
    <SetupButton tone="secondary" onClick={close} gamepad="cancel">
      Закрити
    </SetupButton>
  );

  let title = 'Millennium і плагін «LBK Bridge»';
  let body: React.ReactNode;
  let footer: React.ReactNode;
  let dismissable = true;

  switch (step.kind) {
    case 'intro': {
      if (mode === 'loading') {
        body = <SetupProgress text="Перевірка системи…" percent={null} />;
        footer = <SetupFooter>{closeButton}</SetupFooter>;
        break;
      }
      if (mode === 'unsupported' || mode === 'external') {
        const reason = state?.millennium.unsupportedReason ?? null;
        body = (
          <SetupText
            paragraphs={[
              mode === 'external' ? EXTERNAL_TEXT : millenniumUnsupportedText(reason),
            ]}
          />
        );
        footer = (
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
            {closeButton}
          </SetupFooter>
        );
        break;
      }
      if (mode === 'pending') {
        body = <SetupText paragraphs={queuedParagraphs()} />;
        footer = (
          <SetupFooter>
            {state?.steamRunning && state.canRestartSteam && (
              <SetupButton
                tone="primary"
                onClick={() => void restartSteamAndWait()}
                disabled={busy}
                gamepad="confirm"
                icon={<RotateCwIcon size={16} />}
              >
                Перезапустити Steam зараз
              </SetupButton>
            )}
            {closeButton}
          </SetupFooter>
        );
        break;
      }
      if (mode === 'update' || mode === 'repair') {
        title = mode === 'update' ? 'Оновлення Millennium' : 'Відновлення Millennium';
        body = (
          <SetupText
            paragraphs={[
              mode === 'update'
                ? `Доступне оновлення Millennium: ${state?.millennium.update?.version ?? ''}.`
                : 'Файли Millennium у теці Steam пошкоджено або видалено.',
              'Для цього Steam потрібно буде закрити й запустити знову.',
            ]}
          />
        );
        footer = (
          <SetupFooter>
            <SetupButton
              tone="primary"
              onClick={() => void startInstall()}
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
            <SetupButton tone="secondary" onClick={close} gamepad="cancel">
              Скасувати
            </SetupButton>
          </SetupFooter>
        );
        break;
      }
      body = <SetupText paragraphs={offerParagraphs()} />;
      footer = (
        <SetupFooter>
          <SetupButton
            tone="primary"
            onClick={() => void startInstall()}
            disabled={busy}
            gamepad="confirm"
            icon={<DownloadIcon size={16} />}
          >
            Встановити
          </SetupButton>
          <SetupButton tone="secondary" onClick={close} gamepad="cancel">
            {source === 'offer' ? 'Не зараз' : 'Скасувати'}
          </SetupButton>
          {source === 'offer' && (
            <SetupButton tone="secondary" onClick={handleDecline}>
              Більше не пропонувати
            </SetupButton>
          )}
        </SetupFooter>
      );
      break;
    }
    case 'working':
      dismissable = false;
      body = <SetupProgress text={step.text} percent={step.percent} />;
      footer = step.cancellable ? (
        <SetupFooter>
          <SetupButton tone="secondary" onClick={handleCancelDownload} gamepad="cancel">
            Скасувати
          </SetupButton>
        </SetupFooter>
      ) : null;
      break;
    case 'confirm-restart':
      body = (
        <SetupText
          paragraphs={[
            'Щоб завершити встановлення, Steam потрібно закрити й запустити знову.',
            ...(step.note ? [step.note] : []),
          ]}
        />
      );
      footer = (
        <SetupFooter>
          {step.canRestart && (
            <SetupButton
              tone="primary"
              onClick={() => void activate('now')}
              gamepad="confirm"
              icon={<RotateCwIcon size={16} />}
            >
              Перезапустити Steam зараз
            </SetupButton>
          )}
          <SetupButton
            tone={step.canRestart ? 'secondary' : 'primary'}
            onClick={() => void activate('on-exit')}
            gamepad={step.canRestart ? undefined : 'confirm'}
          >
            Після закриття Steam
          </SetupButton>
          <SetupButton tone="secondary" onClick={close} gamepad="cancel">
            Не зараз
          </SetupButton>
        </SetupFooter>
      );
      break;
    case 'waiting-plugin':
      body = (
        <SetupProgress
          text={millenniumPhaseText('wait-plugin', 'install')}
          percent={null}
        />
      );
      footer = <SetupFooter>{closeButton}</SetupFooter>;
      break;
    case 'done':
      body = <SetupText paragraphs={step.paragraphs} />;
      footer = (
        <SetupFooter>
          <SetupButton tone="primary" onClick={close} gamepad="confirm">
            Зрозуміло
          </SetupButton>
        </SetupFooter>
      );
      break;
    case 'error':
      body = <SetupText paragraphs={[step.message]} />;
      footer = (
        <SetupFooter>
          {step.actions === 'retry' && (
            <SetupButton
              tone="primary"
              onClick={() => void startInstall()}
              gamepad="confirm"
              icon={<RotateCwIcon size={16} />}
            >
              Спробувати ще раз
            </SetupButton>
          )}
          {step.actions === 'site' && (
            <SetupButton
              tone="primary"
              onClick={openMillenniumSite}
              gamepad="confirm"
              icon={<ExternalLinkIcon size={16} />}
            >
              Відкрити сайт Millennium
            </SetupButton>
          )}
          {step.actions === 'steam-not-back' && (
            <>
              <SetupButton
                tone="danger"
                onClick={() => void uninstallAfterFailure()}
                gamepad="confirm"
                icon={<Trash2Icon size={16} />}
              >
                Видалити Millennium
              </SetupButton>
              <SetupButton
                tone="secondary"
                onClick={() => void restartSteamAndWait()}
                icon={<PlayIcon size={16} />}
              >
                Запустити Steam
              </SetupButton>
            </>
          )}
          {step.actions === 'env-missing' && (
            <SetupButton
              tone="primary"
              onClick={() => void restartSteamAndWait()}
              gamepad="confirm"
              icon={<RotateCwIcon size={16} />}
            >
              Перезапустити Steam
            </SetupButton>
          )}
          {step.actions === 'recheck' && (
            <SetupButton
              tone="primary"
              onClick={() => void handleRecheck()}
              busy={isRechecking}
              gamepad="confirm"
              icon={
                <AppActionIcon
                  phase={recheckPhase}
                  icon={RefreshCw}
                  size={16}
                  inheritColor
                />
              }
            >
              Перевірити ще раз
            </SetupButton>
          )}
          {closeButton}
        </SetupFooter>
      );
      break;
  }

  return (
    <SetupFrame title={title} dismissable={dismissable} onClose={close} footer={footer}>
      {body}
    </SetupFrame>
  );
};
