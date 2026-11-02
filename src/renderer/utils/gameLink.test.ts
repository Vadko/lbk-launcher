import { describe, expect, it } from 'vitest';
import type { GameLinkTarget } from '@/shared/game-link-target';
import { gameLink } from './gameLink';

const THREAD = '0b6f3f0e-5c1a-4d2e-9f3b-2a1c4d5e6f70';
const ENTRY = '3d2c1b0a-9f8e-4d7c-8b6a-5f4e3d2c1b0a';

describe('gameLink', () => {
  it.each<[string, GameLinkTarget, string]>([
    [
      'opens the reviews tab on the named entry',
      { gameId: 'game-1', feedbackId: THREAD, entryId: ENTRY },
      `/game/game-1?tab=reviews&thread=${THREAD}&entry=${ENTRY}`,
    ],
    [
      'focuses the thread itself when only the thread is known',
      { gameId: 'game-1', feedbackId: THREAD },
      `/game/game-1?tab=reviews&thread=${THREAD}&entry=${THREAD}`,
    ],
    [
      'opens the game page for a notice without review ids',
      { gameId: 'game-1' },
      '/game/game-1',
    ],
    [
      'opens the game page for an entry without its thread',
      { gameId: 'game-1', entryId: ENTRY },
      '/game/game-1',
    ],
  ])('%s', (_case, target, expected) => {
    expect(gameLink(target)).toBe(expected);
  });
});
