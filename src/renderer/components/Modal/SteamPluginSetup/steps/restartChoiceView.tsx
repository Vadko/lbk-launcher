import { RotateCwIcon } from 'lucide-react';
import { t } from '@/shared/i18n/i18n';
import type { RestartChoice } from '../millenniumSetup';
import { SetupButton, SetupFooter, SetupText, type SetupView } from '../SetupParts';
import { setupView } from './setupView';

interface RestartChoiceViewProps {
  title: string;
  paragraphs: readonly string[];
  canRestart: boolean;
  onChoose: (restart: RestartChoice) => void;
  onClose: () => void;
  // Adds «Не зараз»; the uninstall confirmation goes on without it.
  cancellable: boolean;
}

export function restartChoiceView({
  title,
  paragraphs,
  canRestart,
  onChoose,
  onClose,
  cancellable,
}: RestartChoiceViewProps): SetupView {
  return setupView(
    title,
    <SetupText paragraphs={paragraphs} />,
    <SetupFooter>
      {canRestart && (
        <SetupButton
          tone="primary"
          onClick={() => onChoose('now')}
          gamepad="confirm"
          icon={<RotateCwIcon size={16} />}
        >
          {t('common.restartSteamNow')}
        </SetupButton>
      )}
      <SetupButton
        tone={canRestart ? 'secondary' : 'primary'}
        onClick={() => onChoose('on-exit')}
        gamepad={canRestart ? undefined : 'confirm'}
      >
        {t('common.afterSteamExit')}
      </SetupButton>
      {cancellable && (
        <SetupButton tone="secondary" onClick={onClose} gamepad="cancel">
          {t('common.notNow')}
        </SetupButton>
      )}
    </SetupFooter>
  );
}
