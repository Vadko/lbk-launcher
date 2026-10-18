import React from 'react';
import {
  SetupCloseButton,
  SetupFooter,
  SetupFrame,
  SetupNote,
  SetupProgress,
} from '../SetupParts';

interface WaitingPluginStepProps {
  title: string;
  text: string;
  onClose: () => void;
  note?: string | null;
  // Extra footer buttons, placed before «Закрити».
  children?: React.ReactNode;
}

export const WaitingPluginStep: React.FC<WaitingPluginStepProps> = ({
  title,
  text,
  onClose,
  note = null,
  children,
}) => (
  <SetupFrame
    title={title}
    dismissable
    onClose={onClose}
    footer={
      <SetupFooter>
        {children}
        <SetupCloseButton onClose={onClose} />
      </SetupFooter>
    }
  >
    <SetupProgress text={text} percent={null} />
    <SetupNote text={note} />
  </SetupFrame>
);
