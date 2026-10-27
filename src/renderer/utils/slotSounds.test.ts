import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LEVER_PULL } from '../components/Modal/ReviewAuthorPicker/slotLeverMotion';
import { getAudioContext } from './audioContext';
import { FakeAudioContext } from './fakeAudioContext.fixture';
import {
  playHoldClick,
  playLeverPull,
  playLeverThunk,
  playRatchetClick,
  playReelStop,
  playWinChime,
  startReelWhirr,
  warmSlotSounds,
} from './slotSounds';

const settings = vi.hoisted(() => ({ gamepadSoundsEnabled: true }));
let focused = true;

vi.mock('../store/useSettingsStore', () => ({
  useSettingsStore: { getState: () => settings },
}));
vi.stubGlobal('AudioContext', FakeAudioContext);
vi.stubGlobal('document', { hasFocus: () => focused });

const context = () => {
  getAudioContext();
  return FakeAudioContext.latest();
};

describe('slot sounds', () => {
  beforeEach(() => {
    settings.gamepadSoundsEnabled = true;
    focused = true;
    context().sources = [];
  });

  const sounds = [
    ['the lever pull', playLeverPull],
    ['a ratchet tooth', playRatchetClick],
    ['the lever thunk', playLeverThunk],
    ['a reel stop', playReelStop],
    ['a hold toggle', playHoldClick],
    ['the win chime', playWinChime],
  ] as const;

  it.each(sounds)(
    'plays %s while sounds are on and the window has focus',
    (_label, play) => {
      play();

      expect(context().sources.length).toBeGreaterThan(0);
      expect(
        context().sources.every((source) => source.start.mock.calls.length === 1)
      ).toBe(true);
    }
  );

  it.each(sounds)('keeps %s silent with sounds off', (_label, play) => {
    settings.gamepadSoundsEnabled = false;

    play();

    expect(context().sources).toEqual([]);
  });

  it.each(sounds)('keeps %s silent in a background window', (_label, play) => {
    focused = false;

    play();

    expect(context().sources).toEqual([]);
  });

  it('runs the ratchet down and thunks when the lever bottoms out', () => {
    playLeverPull();

    const starts = context().sources.map((source) => source.start.mock.calls[0][0]);
    expect(new Set(starts).size).toBe(7);
    expect(Math.max(...starts)).toBeCloseTo(LEVER_PULL.duration ?? 0);
  });

  it('rings the payout bell ten times', () => {
    playWinChime();

    const oscillators = context().sources.filter((source) => source.buffer === null);
    const strikes = new Set(oscillators.map((source) => source.start.mock.calls[0][0]));
    expect(strikes.size).toBe(10);
  });
});

describe('reel whirr', () => {
  beforeEach(() => {
    settings.gamepadSoundsEnabled = true;
    focused = true;
    context().sources = [];
  });

  it('runs until stopped, and a second stop does nothing', () => {
    const whirr = startReelWhirr();
    const running = context().sources;

    whirr.setLevel(0.5);
    whirr.stop();
    whirr.stop();

    expect(running.length).toBeGreaterThan(0);
    expect(running.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
  });

  it.each([
    ['sounds are off', () => (settings.gamepadSoundsEnabled = false)],
    ['the window is in the background', () => (focused = false)],
  ])('hands back a silent whirr when %s', (_label, mute) => {
    mute();

    const whirr = startReelWhirr();
    whirr.setLevel(1);
    whirr.stop();

    expect(context().sources).toEqual([]);
  });
});

describe('warmSlotSounds', () => {
  beforeEach(() => {
    settings.gamepadSoundsEnabled = true;
    focused = true;
    context().sources = [];
  });

  it('opens the audio context without playing anything', () => {
    warmSlotSounds();

    expect(context().sources).toEqual([]);
  });
});
