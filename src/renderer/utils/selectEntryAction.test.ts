import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGamepadModeStore } from '../store/useGamepadModeStore';
import { fakeElement, fakeEntry, stubDocument } from './gamepadDom.fixture';
import { selectEntryAction } from './selectEntryAction';

beforeEach(() => {
  stubDocument();
  useGamepadModeStore.setState({ navigationArea: 'header' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('selectEntryAction', () => {
  it('focuses the first action in the main content area', () => {
    const action = fakeElement();

    selectEntryAction(fakeEntry('review-e1', action));

    expect(action.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(useGamepadModeStore.getState().navigationArea).toBe('main-content');
  });

  it('still moves to the main content for an entry without actions', () => {
    selectEntryAction(fakeEntry('review-e1', null));

    expect(useGamepadModeStore.getState().navigationArea).toBe('main-content');
  });
});
