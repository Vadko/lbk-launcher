import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeElement, stubDocument } from './gamepadDom.fixture';
import { getTopDialog } from './getTopDialog';

const LOWER = fakeElement();
const UPPER = fakeElement();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getTopDialog', () => {
  it.each<[string, Element[], Element | null]>([
    ['no dialog', [], null],
    ['one dialog', [LOWER], LOWER],
    ['a dialog stacked on another', [LOWER, UPPER], UPPER],
  ])('answers for %s', (_case, dialogs, expected) => {
    stubDocument({ dialogs });

    expect(getTopDialog()).toBe(expected);
  });
});
