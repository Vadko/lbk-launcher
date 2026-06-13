import type { Game } from '../../shared/types';

export const isTranslationInstallable = (status: Game['status']): boolean =>
  status !== 'planned' && status !== 'tech-improvement';
