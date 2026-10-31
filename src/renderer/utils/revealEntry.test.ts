import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGamepadModeStore } from '../store/useGamepadModeStore';
import { fakeElement, fakeEntry, fakeTextArea, stubDocument } from './gamepadDom.fixture';
import { revealEntry } from './revealEntry';

beforeEach(() => {
  vi.useFakeTimers();
  useGamepadModeStore.setState({
    isGamepadMode: true,
    navigationArea: 'games',
    entryHandOver: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('revealEntry', () => {
  it.each<[string, boolean, ScrollBehavior]>([
    ['animations on', true, 'smooth'],
    ['animations off', false, 'instant'],
  ])('centres the entry with %s', (_case, animationsEnabled, behavior) => {
    const entry = fakeEntry('review-e1', null);
    stubDocument({ elements: [entry] });

    revealEntry('e1', animationsEnabled);

    expect(entry.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior });
  });

  it('highlights the entry for a second', () => {
    const entry = fakeEntry('review-e1', null);
    stubDocument({ elements: [entry] });

    revealEntry('e1', false);
    vi.advanceTimersByTime(999);

    expect(entry.classList.add).toHaveBeenCalledWith('review-focus');
    expect(entry.classList.remove).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(entry.classList.remove).toHaveBeenCalledWith('review-focus');
  });

  it.each<[string, Element[], string, string | null, boolean]>([
    ['no dialog up', [], 'main-content', null, true],
    ['a dialog up', [fakeElement()], 'games', 'review-e1', false],
  ])(
    'with %s, selects the first action or hands the entry over',
    (_case, dialogs, area, handOver, isFocused) => {
      const action = fakeElement();
      stubDocument({ dialogs, elements: [fakeEntry('review-e1', action)] });

      revealEntry('e1', false);

      const state = useGamepadModeStore.getState();
      expect(state.navigationArea).toBe(area);
      expect(state.entryHandOver).toBe(handOver);
      expect(vi.mocked(action.focus).mock.calls).toEqual(
        isFocused ? [[{ preventScroll: true }]] : []
      );
    }
  );

  it('lets a later reveal behind a dialog replace the hand-over', () => {
    stubDocument({
      dialogs: [fakeElement()],
      elements: [fakeEntry('review-e1', null), fakeEntry('review-e2', null)],
    });

    revealEntry('e1', false);
    revealEntry('e2', false);

    expect(useGamepadModeStore.getState().entryHandOver).toBe('review-e2');
  });

  it('marks a text field action instead of focusing it', () => {
    const field = fakeTextArea();
    stubDocument({ elements: [fakeEntry('review-e1', field)] });

    revealEntry('e1', false);

    expect(field.setAttribute).toHaveBeenCalledWith('data-gamepad-selected', 'true');
    expect(field.focus).not.toHaveBeenCalled();
  });

  it('leaves gamepad focus alone outside gamepad mode', () => {
    useGamepadModeStore.setState({ isGamepadMode: false });
    const action = fakeElement();
    stubDocument({ elements: [fakeEntry('review-e1', action)] });

    revealEntry('e1', false);

    expect(action.focus).not.toHaveBeenCalled();
    expect(useGamepadModeStore.getState().navigationArea).toBe('games');
  });

  it('does nothing for an entry that is not on the page', () => {
    stubDocument();

    revealEntry('e1', false);

    expect(useGamepadModeStore.getState().entryHandOver).toBeNull();
  });
});
