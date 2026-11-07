import { describe, expect, it } from 'vitest';
import { fakeDialog, fakeElement } from './gamepadDom.fixture';
import { type DialogFocusEntry, nextDialogFocus } from './nextDialogFocus';

const pageButton = fakeElement();
const settingsButton = fakeElement();
const optionsButton = fakeElement();
const settings = fakeDialog(settingsButton);
const options = fakeDialog(optionsButton);
const setup = fakeDialog(fakeElement());
// Closed: React has taken it out of the document
const closedSettings = Object.assign(fakeDialog(), { isConnected: false });

const NAMES = new Map<HTMLElement | null, string>([
  [null, 'none'],
  [pageButton, 'page button'],
  [settingsButton, 'settings button'],
  [optionsButton, 'options button'],
  [settings, 'settings'],
  [options, 'options'],
  [setup, 'setup'],
  [closedSettings, 'closed settings'],
]);
const name = (el: HTMLElement | null) => NAMES.get(el);
const entry = (dialog: HTMLElement, opener: HTMLElement | null): DialogFocusEntry => ({
  dialog,
  opener,
});

describe('nextDialogFocus', () => {
  it.each<
    [
      string,
      DialogFocusEntry[],
      HTMLElement | null,
      HTMLElement | null,
      [string, string?],
      string[][],
    ]
  >([
    ['nothing open', [], null, null, ['same'], []],
    [
      'the same dialog on top',
      [entry(settings, pageButton)],
      settings,
      settingsButton,
      ['same'],
      [['settings', 'page button']],
    ],
    [
      'a dialog opened from the page',
      [],
      settings,
      pageButton,
      ['opened'],
      [['settings', 'page button']],
    ],
    [
      'a dialog opened over another',
      [entry(settings, pageButton)],
      setup,
      settingsButton,
      ['opened'],
      [
        ['settings', 'page button'],
        ['setup', 'settings button'],
      ],
    ],
    [
      'a dialog that took focus as it opened',
      [],
      options,
      optionsButton,
      ['opened'],
      [['options', 'none']],
    ],
    [
      'a dialog opened in place of one that closed',
      [entry(closedSettings, pageButton)],
      setup,
      null,
      ['opened'],
      [['setup', 'page button']],
    ],
    [
      'the dialogs above another closed',
      [entry(options, pageButton), entry(settings, optionsButton), entry(setup, null)],
      options,
      null,
      ['returned', 'options button'],
      [['options', 'page button']],
    ],
    [
      'the last dialog closed',
      [entry(settings, pageButton), entry(setup, settingsButton)],
      null,
      null,
      ['closed', 'page button'],
      [],
    ],
  ])('steps on %s', (_case, stack, top, focused, [kind, opener], next) => {
    const step = nextDialogFocus(stack, top, focused);

    expect(step.change.kind).toBe(kind);
    expect('opener' in step.change ? name(step.change.opener) : undefined).toBe(opener);
    expect(step.stack.map((e) => [name(e.dialog), name(e.opener)])).toEqual(next);
  });
});
