import { Fragment } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

interface LanguageBoundaryProps {
  children: React.ReactNode;
}

// Most components call the imported `t`, so they only pick a new language up by remounting.
export function LanguageBoundary({ children }: LanguageBoundaryProps) {
  const language = useSettingsStore((state) => state.language);
  return <Fragment key={language}>{children}</Fragment>;
}
