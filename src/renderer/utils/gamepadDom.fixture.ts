import { vi } from 'vitest';

class FakeElement {
  id = '';
  focus: HTMLElement['focus'] = vi.fn();
  blur: HTMLElement['blur'] = vi.fn();
  setAttribute: HTMLElement['setAttribute'] = vi.fn();
  removeAttribute: HTMLElement['removeAttribute'] = vi.fn();
  scrollIntoView: HTMLElement['scrollIntoView'] = vi.fn(() =>
    Promise.resolve({ interrupted: false })
  );
}

class FakeInput extends FakeElement {
  type = 'text';
  readOnly = false;
}

class FakeTextArea extends FakeElement {}

export const fakeElement = (): HTMLElement => new FakeElement() as HTMLElement;

export const fakeInput = (type: string, readOnly = false): HTMLInputElement =>
  Object.assign(new FakeInput(), { type, readOnly }) as HTMLInputElement;

export const fakeTextArea = (): HTMLTextAreaElement =>
  new FakeTextArea() as HTMLTextAreaElement;

// A review entry, whose only gamepad action is the one given
export const fakeEntry = (id: string, action: HTMLElement | null): HTMLElement =>
  Object.assign(new FakeElement(), {
    id,
    querySelector: (selector: string) =>
      selector === '[data-gamepad-action]' ? action : null,
  }) as HTMLElement;

interface FakeDocument {
  activeElement?: Element | null;
  marked?: Element[];
  dialogs?: Element[];
  // What getElementById finds, by each element's id
  elements?: HTMLElement[];
}

// The node test environment has no DOM, so the gamepad helpers meet these stand-ins
export function stubDocument({
  activeElement = null,
  marked = [],
  dialogs = [],
  elements = [],
}: FakeDocument = {}): void {
  vi.stubGlobal('HTMLInputElement', FakeInput);
  vi.stubGlobal('HTMLTextAreaElement', FakeTextArea);
  const lists: Record<string, Element[]> = {
    '[data-gamepad-selected]': marked,
    '[role="dialog"]': dialogs,
  };
  vi.stubGlobal('document', {
    activeElement,
    querySelector: (selector: string) => lists[selector]?.[0] ?? null,
    querySelectorAll: (selector: string) => lists[selector] ?? [],
    getElementById: (id: string) => elements.find((el) => el.id === id) ?? null,
  });
}
