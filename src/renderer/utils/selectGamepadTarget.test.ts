import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeElement, fakeInput, fakeTextArea, stubDocument } from './gamepadDom.fixture';
import { selectGamepadTarget } from './selectGamepadTarget';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('selectGamepadTarget', () => {
  it.each<[string, () => HTMLElement]>([
    ['a text area', fakeTextArea],
    ['a text input', () => fakeInput('text')],
  ])('only marks %s, so the on-screen keyboard waits for A', (_case, make) => {
    const active = fakeElement();
    const field = make();
    stubDocument({ activeElement: active });

    selectGamepadTarget(field);

    expect(field.setAttribute).toHaveBeenCalledWith('data-gamepad-selected', 'true');
    expect(field.focus).not.toHaveBeenCalled();
    expect(active.blur).toHaveBeenCalled();
  });

  it.each<[string, () => HTMLElement]>([
    ['a button', fakeElement],
    ['a checkbox', () => fakeInput('checkbox')],
  ])('focuses %s without scrolling to it', (_case, make) => {
    const target = make();
    stubDocument();

    selectGamepadTarget(target);

    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(target.setAttribute).not.toHaveBeenCalled();
  });

  it('clears an earlier mark first', () => {
    const earlier = fakeTextArea();
    stubDocument({ marked: [earlier] });

    selectGamepadTarget(fakeElement());

    expect(earlier.removeAttribute).toHaveBeenCalledWith('data-gamepad-selected');
  });
});
