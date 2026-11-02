import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearGamepadSelected } from './clearGamepadSelected';
import { fakeElement, stubDocument } from './gamepadDom.fixture';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clearGamepadSelected', () => {
  it('drops the mark from every marked element', () => {
    const marked = [fakeElement(), fakeElement()];
    stubDocument({ marked });

    clearGamepadSelected();

    expect(marked.map((el) => vi.mocked(el.removeAttribute).mock.calls)).toEqual([
      [['data-gamepad-selected']],
      [['data-gamepad-selected']],
    ]);
  });
});
