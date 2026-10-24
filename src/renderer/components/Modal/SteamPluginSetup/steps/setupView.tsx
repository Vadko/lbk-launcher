import React from 'react';
import {
  SetupCloseButton,
  SetupFooter,
  SetupNote,
  SetupText,
  type SetupView,
} from '../SetupParts';

export const setupView = (
  title: string,
  body: React.ReactNode,
  footer: React.ReactNode
): SetupView => ({ title, dismissable: true, body, footer });

export const closeFooter = (onClose: () => void): React.ReactNode => (
  <SetupFooter>
    <SetupCloseButton onClose={onClose} />
  </SetupFooter>
);

interface ResultViewProps {
  title: string;
  paragraphs?: readonly string[];
  // Replaces the paragraphs, e.g. with a progress line while waiting.
  body?: React.ReactNode;
  note?: string | null;
  buttons: React.ReactNode;
}

export function resultView({
  title,
  paragraphs = [],
  body,
  note = null,
  buttons,
}: ResultViewProps): SetupView {
  return setupView(
    title,
    <>
      {body ?? <SetupText paragraphs={paragraphs} />}
      <SetupNote text={note} />
    </>,
    <SetupFooter>{buttons}</SetupFooter>
  );
}
