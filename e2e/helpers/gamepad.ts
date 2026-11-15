import type { Page } from '@playwright/test';

// Standard mapping, as useGamepadModeNavigation reads it
export const BUTTON = {
  A: 0,
  B: 1,
  LT: 6,
  RT: 7,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const;

type Button = (typeof BUTTON)[keyof typeof BUTTON];

interface FakeButton {
  pressed: boolean;
  touched: boolean;
  value: number;
}

declare global {
  interface Window {
    __e2eGamepad?: { buttons: FakeButton[]; reads: number };
  }
}

// Chromium sees no real pad here, so the renderer gets one through navigator.getGamepads() and a gamepadconnected event
export async function connectGamepad(page: Page) {
  await page.evaluate(() => {
    const pad = {
      id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)',
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      vibrationActuator: null,
      reads: 0,
    };
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => {
        pad.reads++;
        return [pad, null, null, null];
      },
    });
    window.__e2eGamepad = pad;
    // Any mouse move leaves gamepad mode, so a real cursor over the window must not reach the app
    window.addEventListener('mousemove', (e) => e.stopImmediatePropagation(), true);
    const event = new Event('gamepadconnected');
    Object.defineProperty(event, 'gamepad', { value: pad });
    window.dispatchEvent(event);
  });
}

// Returns how many times the page had read the pad before the change
const setButton = (page: Page, button: Button, pressed: boolean) =>
  page.evaluate(
    ({ index, down }) => {
      const pad = window.__e2eGamepad;
      if (!pad) {
        throw new Error('connectGamepad() first');
      }
      const state = pad.buttons[index];
      state.pressed = down;
      state.touched = down;
      state.value = down ? 1 : 0;
      return pad.reads;
    },
    { index: button, down: pressed }
  );

const waitForRead = (page: Page, after: number) =>
  page.waitForFunction((count) => (window.__e2eGamepad?.reads ?? 0) > count, after);

// A busy main thread drops frames, so a timed press can begin and end between two polls; each change waits for the loop to read it
export async function press(page: Page, button: Button) {
  await waitForRead(page, await setButton(page, button, true));
  await waitForRead(page, await setButton(page, button, false));
  await page.waitForTimeout(150);
}
