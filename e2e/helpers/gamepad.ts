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
    __e2eGamepad?: { buttons: FakeButton[] };
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
    };
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [pad, null, null, null],
    });
    window.__e2eGamepad = pad;
    // Any mouse move leaves gamepad mode, so a real cursor over the window must not reach the app
    window.addEventListener('mousemove', (e) => e.stopImmediatePropagation(), true);
    const event = new Event('gamepadconnected');
    Object.defineProperty(event, 'gamepad', { value: pad });
    window.dispatchEvent(event);
  });
}

const setButton = (page: Page, button: Button, pressed: boolean) =>
  page.evaluate(
    ({ index, down }) => {
      const state = window.__e2eGamepad?.buttons[index];
      if (state) {
        state.pressed = down;
        state.touched = down;
        state.value = down ? 1 : 0;
      }
    },
    { index: button, down: pressed }
  );

// Held for a few frames, so the loop sees one press edge, and released well before its 380 ms repeat
export async function press(page: Page, button: Button) {
  await setButton(page, button, true);
  await page.waitForTimeout(80);
  await setButton(page, button, false);
  await page.waitForTimeout(250);
}
