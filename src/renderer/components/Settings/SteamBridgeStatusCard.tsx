import { RefreshCw } from 'lucide';
import { RotateCwIcon } from 'lucide-react';
import React, { useCallback } from 'react';
import { useActionPhase } from '@/renderer/hooks/useActionPhase';
import { useSteamBridgeStatus } from '@/renderer/hooks/useSteamBridgeStatus';
import { useSteamPluginHost } from '@/renderer/hooks/useSteamPluginHost';
import { useSettingsStore } from '@/renderer/store/useSettingsStore';
import { openOfferTarget } from '@/renderer/utils/openOfferTarget';
import { pluginHostEntries } from '@/renderer/utils/pluginHostEntries';
import {
  pendingLaunchOptionsText,
  runSteamRestart,
  steamBridgeStatusText,
} from '@/renderer/utils/steamBridge';
import { AppActionIcon } from '../ui/AppActionIcon';
import { Button } from '../ui/Button';
import { OfferActionIcon } from '../ui/OfferActionIcon';

interface SteamBridgeStatusCardProps {
  isOpen: boolean;
}

export const SteamBridgeStatusCard: React.FC<SteamBridgeStatusCardProps> = ({
  isOpen,
}) => {
  const { status, recheck } = useSteamBridgeStatus(isOpen);
  const settingOn = useSettingsStore((state) => state.steamCefDebuggingEnabled);
  const hostState = useSteamPluginHost(isOpen && settingOn);
  const {
    phase: recheckPhase,
    isPending: isRechecking,
    run: runRecheck,
  } = useActionPhase();

  const handleRecheck = useCallback(async () => {
    if (isRechecking) {
      return;
    }
    try {
      await runRecheck(recheck, { isSuccess: (next) => next !== null });
    } catch (error) {
      console.error('[Settings] Steam bridge recheck failed:', error);
    }
  }, [isRechecking, runRecheck, recheck]);

  const handleRestart = useCallback(() => {
    void runSteamRestart(() => window.electronAPI.restartSteam(), {
      launchOptions: (status?.pendingLaunchOptions.length ?? 0) > 0,
    });
  }, [status]);

  if (!status) {
    return null;
  }

  const statusText = steamBridgeStatusText(status);
  const pendingCount = status.pendingLaunchOptions.length;
  const showRestart = status.code === 'restart-pending' && status.canRestartSteam;
  const showRecheck =
    status.code === 'cef-blocked' || status.code === 'millennium-plugin-pending';
  const { lines, actions } =
    settingOn && hostState ? pluginHostEntries(hostState) : { lines: [], actions: [] };
  const hostBusy = hostState?.busy === true;

  if (
    !statusText &&
    !status.steamElevated &&
    pendingCount === 0 &&
    lines.length === 0 &&
    actions.length === 0
  ) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl bg-glass border border-border text-xs text-text-muted">
      {statusText && <p className="text-text-main">{statusText}</p>}
      {status.steamElevated && (
        <p>
          Steam запущено від імені адміністратора, тому лаунчер не може його
          перезапустити.
        </p>
      )}
      {pendingCount > 0 && <p>{pendingLaunchOptionsText(pendingCount)}</p>}
      {lines.map((line) => (
        <p key={line.key}>{line.text}</p>
      ))}
      {(showRestart || showRecheck || actions.length > 0) && (
        <div className="flex flex-wrap gap-2 mt-1">
          {showRestart && (
            <Button
              onClick={handleRestart}
              variant="secondary"
              data-gamepad-modal-item
              className="px-4! py-2! min-h-0! text-sm"
              icon={<RotateCwIcon size={16} />}
            >
              Перезапустити Steam
            </Button>
          )}
          {showRecheck && (
            <Button
              onClick={handleRecheck}
              aria-busy={isRechecking}
              variant="secondary"
              data-gamepad-modal-item
              className="px-4! py-2! min-h-0! text-sm aria-busy:opacity-60 aria-busy:cursor-wait"
              icon={<AppActionIcon phase={recheckPhase} icon={RefreshCw} size={16} />}
            >
              Перевірити ще раз
            </Button>
          )}
          {actions.map((action) => (
            <Button
              key={action.key}
              onClick={() => openOfferTarget(action.target, 'settings')}
              disabled={hostBusy && !action.external}
              variant="secondary"
              data-gamepad-modal-item
              className="px-4! py-2! min-h-0! text-sm"
              icon={<OfferActionIcon icon={action.icon} size={16} />}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};
