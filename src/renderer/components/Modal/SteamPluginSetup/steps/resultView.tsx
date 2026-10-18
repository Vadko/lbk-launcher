import React from 'react';
import { SetupFooter, SetupNote, SetupText, type SetupView } from '../SetupParts';

interface ResultViewProps {
  title: string;
  paragraphs: readonly string[];
  note?: string | null;
  buttons: React.ReactNode;
}

export function resultView({
  title,
  paragraphs,
  note = null,
  buttons,
}: ResultViewProps): SetupView {
  return {
    title,
    dismissable: true,
    body: (
      <>
        <SetupText paragraphs={paragraphs} />
        <SetupNote text={note} />
      </>
    ),
    footer: <SetupFooter>{buttons}</SetupFooter>,
  };
}
