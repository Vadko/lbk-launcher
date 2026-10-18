import { RotateCwIcon } from 'lucide-react';
import React from 'react';
import { SetupButton, SetupFooter, SetupFrame, SetupText } from '../SetupParts';

interface RestartChoiceStepProps {
  title: string;
  paragraphs: readonly string[];
  canRestart: boolean;
  onChoose: (restart: 'now' | 'on-exit') => void;
  onClose: () => void;
  // Adds «Не зараз»; the uninstall confirmation goes on without it.
  cancellable: boolean;
}

export const RestartChoiceStep: React.FC<RestartChoiceStepProps> = ({
  title,
  paragraphs,
  canRestart,
  onChoose,
  onClose,
  cancellable,
}) => (
  <SetupFrame
    title={title}
    dismissable
    onClose={onClose}
    footer={
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
    }
  >
    <SetupText paragraphs={paragraphs} />
  </SetupFrame>
);
