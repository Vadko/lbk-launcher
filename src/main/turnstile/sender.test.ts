import { describe, expect, it } from 'vitest';
import { isFromCaptchaPage } from './sender';

const ORIGIN = 'https://lbklauncher.com';
const contents = {};
const frame = (origin: string, parent: object | null = null) => ({ origin, parent });

describe('isFromCaptchaPage', () => {
  it('hears the top frame of the captcha window on the page origin', () => {
    expect(
      isFromCaptchaPage(
        { sender: contents, senderFrame: frame(ORIGIN) },
        contents,
        ORIGIN
      )
    ).toBe(true);
  });

  it.each([
    ['another window', { sender: {}, senderFrame: frame(ORIGIN) }],
    ['a frame gone after a navigation', { sender: contents, senderFrame: null }],
    [
      'a subframe on the same origin',
      { sender: contents, senderFrame: frame(ORIGIN, {}) },
    ],
    [
      "Cloudflare's origin",
      { sender: contents, senderFrame: frame('https://challenges.cloudflare.com') },
    ],
    [
      'a lookalike origin',
      { sender: contents, senderFrame: frame('https://lbklauncher.com.example') },
    ],
    ['plain http', { sender: contents, senderFrame: frame('http://lbklauncher.com') }],
  ])('ignores %s', (_label, event) => {
    expect(isFromCaptchaPage(event, contents, ORIGIN)).toBe(false);
  });
});
