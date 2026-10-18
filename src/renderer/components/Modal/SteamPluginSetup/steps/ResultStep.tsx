import React from 'react';
import { SetupFooter, SetupFrame, SetupNote, SetupText } from '../SetupParts';

interface ResultStepProps {
  title: string;
  paragraphs: readonly string[];
  onClose: () => void;
  note?: string | null;
  children: React.ReactNode;
}

export const ResultStep: React.FC<ResultStepProps> = ({
  title,
  paragraphs,
  onClose,
  note = null,
  children,
}) => (
  <SetupFrame
    title={title}
    dismissable
    onClose={onClose}
    footer={<SetupFooter>{children}</SetupFooter>}
  >
    <SetupText paragraphs={paragraphs} />
    <SetupNote text={note} />
  </SetupFrame>
);
