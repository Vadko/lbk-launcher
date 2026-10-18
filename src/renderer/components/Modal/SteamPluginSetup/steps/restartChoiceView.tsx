import { RotateCwIcon } from 'lucide-react';
import type { RestartChoice } from '../millenniumSetup';
import { SetupButton, SetupFooter, SetupText, type SetupView } from '../SetupParts';

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
  return {
    title,
    dismissable: true,
    body: <SetupText paragraphs={paragraphs} />,
    footer: (
      <SetupFooter>
        {canRestart && (
          <SetupButton
            tone="primary"
            onClick={() => onChoose('now')}
            gamepad="confirm"
            icon={<RotateCwIcon size={16} />}
          >
            Перезапустити Steam зараз
          </SetupButton>
        )}
        <SetupButton
          tone={canRestart ? 'secondary' : 'primary'}
          onClick={() => onChoose('on-exit')}
          gamepad={canRestart ? undefined : 'confirm'}
        >
          Після закриття Steam
        </SetupButton>
        {cancellable && (
          <SetupButton tone="secondary" onClick={onClose} gamepad="cancel">
            Не зараз
          </SetupButton>
        )}
      </SetupFooter>
    ),
  };
}
