import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeElement, fakeInput, fakeTextArea, stubDocument } from './gamepadDom.fixture';
import { isTextInput } from './isTextInput';

beforeEach(() => {
  stubDocument();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isTextInput', () => {
  it.each<[string, Element | null, boolean]>([
    ['a text area', fakeTextArea(), true],
    ['a text input', fakeInput('text'), true],
    ['a search input', fakeInput('search'), true],
    ['a read-only input', fakeInput('text', true), false],
    ['a checkbox', fakeInput('checkbox'), false],
    ['a range', fakeInput('range'), false],
    ['a button', fakeElement(), false],
    ['no element', null, false],
  ])('tells whether %s takes typing', (_case, el, expected) => {
    expect(isTextInput(el)).toBe(expected);
  });
});
