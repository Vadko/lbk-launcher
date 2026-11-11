import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

interface LanguageBoundaryProps {
  children: React.ReactNode;
}

// The React Compiler caches each imported t() call with constant arguments per instance, so only a remount shows a new language.
export function LanguageBoundary({ children }: LanguageBoundaryProps) {
  const { i18n } = useTranslation();
  return <Fragment key={i18n.language}>{children}</Fragment>;
}
