import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunInstallerRequest } from '@/shared/types';
import {
  answerRunInstaller,
  askRunInstaller,
  declinePendingRunInstallers,
} from './run-decisions';

const request = (gameId: string, protonPath?: string): RunInstallerRequest => ({
  gameId,
  gameName: `Game ${gameId}`,
  installerPath: `/games/${gameId}/setup.exe`,
  isExe: true,
  protonPath,
});

const settled = (promise: Promise<unknown>) =>
  Promise.race([promise, Promise.resolve('pending')]);

afterEach(() => {
  declinePendingRunInstallers();
});

describe('run installer prompts', () => {
  it('waits for the answer of the game it asked about', async () => {
    const show = vi.fn(() => true);
    const decision = askRunInstaller(request('a'), show);

    expect(show).toHaveBeenCalledWith(request('a'));
    answerRunInstaller('b', { run: true });
    expect(await settled(decision)).toBe('pending');

    answerRunInstaller('a', { run: true, protonPath: '/proton/9' });
    expect(await decision).toEqual({ run: true, protonPath: '/proton/9' });
  });

  it.each([
    [
      'no page to show it on',
      () => askRunInstaller(request('a', '/proton/9'), () => false),
    ],
    [
      'the page going away',
      () => {
        const decision = askRunInstaller(request('a', '/proton/9'), () => true);
        declinePendingRunInstallers();
        return decision;
      },
    ],
    [
      'a newer prompt for the same game',
      () => {
        const decision = askRunInstaller(request('a', '/proton/9'), () => true);
        void askRunInstaller(request('a'), () => true);
        return decision;
      },
    ],
  ])('declines with the preselected Proton on %s', async (_case, ask) => {
    expect(await ask()).toEqual({ run: false, protonPath: '/proton/9' });
  });

  it('answers each prompt once', async () => {
    const decision = askRunInstaller(request('a'), () => true);
    answerRunInstaller('a', { run: true });
    declinePendingRunInstallers();

    expect(await decision).toEqual({ run: true });
  });
});
