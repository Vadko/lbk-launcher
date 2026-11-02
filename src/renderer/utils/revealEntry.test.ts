import { animate } from 'framer-motion';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGamepadModeStore } from '../store/useGamepadModeStore';
import { fakeElement, fakeEntry, fakeTextArea, stubDocument } from './gamepadDom.fixture';
import { revealEntry } from './revealEntry';

vi.mock('framer-motion', () => ({ animate: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(animate).mockClear();
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => ' 168 207 150' }));
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

  it.each<[string, boolean, number[]]>([
    ['fades the tint out with animations on', true, [0, 0.4, 1]],
    ['holds the tint for its second with animations off', false, [0, 1, 1]],
  ])('%s', async (_case, animationsEnabled, times) => {
    const entry = fakeEntry('review-e1', null);
    stubDocument({ elements: [entry] });

    revealEntry('e1', animationsEnabled);
    await vi.advanceTimersByTimeAsync(0);

    const lit = 'rgba(168, 207, 150, 0.14)';
    const clear = 'rgba(168, 207, 150, 0)';
    expect(animate).toHaveBeenCalledWith(
      entry,
      expect.objectContaining({ backgroundColor: [lit, lit, clear] }),
      expect.objectContaining({ duration: 1, times })
    );
  });

  it.each<[string, boolean, number]>([
    ['lights the entry once its scroll stops', false, 1],
    ['leaves the entry unlit when its scroll is cut short', true, 0],
  ])('%s', async (_case, interrupted, lit) => {
    let settle: (result: ScrollResult) => void = () => undefined;
    const scrolled = new Promise<ScrollResult>((resolve) => {
      settle = resolve;
    });
    const entry = Object.assign(fakeEntry('review-e1', null), {
      scrollIntoView: () => scrolled,
    });
    stubDocument({ elements: [entry] });

    revealEntry('e1', true);
    await vi.advanceTimersByTimeAsync(1200);
    expect(animate).not.toHaveBeenCalled();
    settle({ interrupted });
    await vi.advanceTimersByTimeAsync(0);

    expect(animate).toHaveBeenCalledTimes(lit);
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
