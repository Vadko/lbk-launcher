import React from 'react';
import {
  SetupCloseButton,
  SetupFooter,
  SetupNote,
  SetupProgress,
  type SetupView,
} from '../SetupParts';

interface WaitingPluginViewProps {
  title: string;
  text: string;
  onClose: () => void;
  note?: string | null;
  // Extra footer buttons, placed before «Закрити».
  buttons?: React.ReactNode;
}

export function waitingPluginView({
  title,
  text,
  onClose,
  note = null,
  buttons,
}: WaitingPluginViewProps): SetupView {
  return {
    title,
    dismissable: true,
    body: (
      <>
        <SetupProgress text={text} percent={null} />
        <SetupNote text={note} />
      </>
    ),
    footer: (
      <SetupFooter>
        {buttons}
        <SetupCloseButton onClose={onClose} />
      </SetupFooter>
    ),
  };
}
