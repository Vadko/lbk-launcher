import { beforeEach, describe, expect, it } from 'vitest';
import { useGamepadModeStore } from './useGamepadModeStore';

beforeEach(() => {
  useGamepadModeStore.setState({ isGamepadMode: true, entryHandOver: null });
});

describe('useGamepadModeStore entry hand-over', () => {
  it('is taken once', () => {
    useGamepadModeStore.getState().handOverEntry('review-e1');

    const store = useGamepadModeStore.getState();
    expect([store.takeEntryHandOver(), store.takeEntryHandOver()]).toEqual([
      'review-e1',
      null,
    ]);
  });

  it.each<[string, boolean, string | null]>([
    ['leaving gamepad mode drops it', false, null],
    ['a repeated switch into gamepad mode keeps it', true, 'review-e1'],
  ])('%s', (_case, enabled, expected) => {
    useGamepadModeStore.getState().handOverEntry('review-e1');

    useGamepadModeStore.getState().setGamepadMode(enabled);

    expect(useGamepadModeStore.getState().entryHandOver).toBe(expected);
  });
});
