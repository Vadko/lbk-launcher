import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEVER_DRAG_STEP_S,
  LEVER_PULL,
} from '../components/Modal/ReviewAuthorPicker/slotLeverMotion';
import { getAudioContext } from './audioContext';
import { FakeAudioContext } from './fakeAudioContext.fixture';
import {
  playHoldClick,
  playLeverPull,
  playLeverThunk,
  playRatchetRun,
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
vi.stubGlobal(
  'fetch',
  vi.fn(() => Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) }))
);

const context = () => {
  getAudioContext();
  return FakeAudioContext.latest();
};

const semitones = (steps: number) => 2 ** (steps / 12);

// Each test starts later than anything the one before queued, as the audio clock only runs forward
let clock = 0;

// When, counted from the test's start, how fast and how loud each started source plays
const played = () =>
  context().sources.map((source) => ({
    at: source.start.mock.calls[0]?.[0] - clock,
    rate: source.playbackRate.value,
    gain: source.level?.gain.value,
  }));

// The recordings decode once per module, so every test after this one plays them at once
beforeAll(async () => {
  warmSlotSounds();
  warmSlotSounds();
  await vi.waitFor(() => expect(context().decodeAudioData).toHaveBeenCalledTimes(6));
  await vi.waitFor(() => {
    context().sources = [];
    playHoldClick(true);
    expect(context().sources).toHaveLength(1);
  });
});

beforeEach(() => {
  settings.gamepadSoundsEnabled = true;
  focused = true;
  context().sources = [];
  clock += 10;
  context().currentTime = clock;
});

describe('slot sounds', () => {
  const sounds = [
    ['the lever pull', playLeverPull],
    ['a ratchet tooth', () => playRatchetRun([1], LEVER_DRAG_STEP_S)],
    ['the lever thunk', playLeverThunk],
    ['a reel stop', () => playReelStop(0)],
    ['a hold toggle', () => playHoldClick(true)],
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

  it('runs the ticks up the scale and thunks when the lever bottoms out', () => {
    playLeverPull();

    const [thunk, ...ticks] = played().sort((a, b) => b.at - a.at);
    expect(thunk.at).toBeCloseTo(LEVER_PULL.duration ?? 0);
    expect(new Set(ticks.map((tick) => tick.at)).size).toBe(6);
    const rates = [0, 2, 4, 7, 9, 12].map(semitones);
    expect(ticks.reverse().map((tick) => tick.rate)).toEqual(rates);
    ticks.forEach((tick, index) =>
      expect(tick.gain).toBeCloseTo(0.35 * Math.sqrt(rates[index]))
    );
  });

  it('pitches every clip from its first sample instead of scheduling the rate', () => {
    playLeverPull();
    playReelStop(2);
    playHoldClick(false);

    expect(
      context().sources.every(
        (source) => source.playbackRate.setValueAtTime.mock.calls.length === 0
      )
    ).toBe(true);
  });

  it('rings the payout once', () => {
    playWinChime();

    expect(context().sources).toHaveLength(1);
  });

  it.each([
    ['the first reel on the root', 0, 0],
    ['the second reel a major third up', 1, 4],
    ['the last reel on the fifth', 2, 7],
    ['a reel before the first like the first', -1, 0],
    ['a reel past the last like the last', 3, 7],
  ])(
    'lands %s, louder as it rises so the figure does not fade',
    (_label, reel, steps) => {
      playReelStop(reel);

      const [stop] = played();
      expect(stop.rate).toBeCloseTo(semitones(steps));
      expect(stop.gain).toBeCloseTo(0.5 * Math.sqrt(semitones(steps)));
    }
  );

  it.each([
    ['the first tooth on E', 1, 0],
    ['the second on F sharp', 2, 2],
    ['the third on G sharp', 3, 4],
    ['the fourth on B', 4, 7],
    ['the fifth on C sharp', 5, 9],
    ['the last an octave up', 6, 12],
    ['a tooth before the first like the first', 0, 0],
    ['a tooth past the last like the last', 7, 12],
  ])('clicks %s', (_label, tooth, steps) => {
    playRatchetRun([tooth], LEVER_DRAG_STEP_S);

    const [tick] = played();
    expect(tick.rate).toBeCloseTo(semitones(steps));
    expect(tick.gain).toBeCloseTo(0.35 * Math.sqrt(semitones(steps)));
  });

  it('spreads teeth passed together over the time given, up the scale', () => {
    playRatchetRun([1, 2, 3], 0.06);

    expect(played()).toEqual([
      expect.objectContaining({ at: 0, rate: 1 }),
      expect.objectContaining({
        at: expect.closeTo(0.02),
        rate: expect.closeTo(semitones(2)),
      }),
      expect.objectContaining({
        at: expect.closeTo(0.04),
        rate: expect.closeTo(semitones(4)),
      }),
    ]);
  });

  it('queues a run behind the teeth still to sound', () => {
    playRatchetRun([1, 2], 0.02);
    playRatchetRun([3], 0.1);

    expect(played().map((tick) => tick.at)).toEqual([
      0,
      expect.closeTo(0.01),
      expect.closeTo(0.02),
    ]);
  });

  it('opens nothing for a step that passes no tooth', () => {
    playRatchetRun([], LEVER_DRAG_STEP_S);

    expect(context().sources).toEqual([]);
  });

  it.each([
    ['locks a reel at the clip’s own pitch', true, 0],
    ['releases it a fourth lower', false, -5],
  ])('%s', (_label, on, steps) => {
    playHoldClick(on);

    const [click] = played();
    expect(click.rate).toBeCloseTo(semitones(steps));
    expect(click.gain).toBeCloseTo(0.4);
  });
});

describe('reel whirr', () => {
  it('runs until stopped, and a second stop does nothing', () => {
    const whirr = startReelWhirr();
    const running = context().sources;

    whirr.setLevel(0.5);
    whirr.stop();
    whirr.stop();

    expect(running.length).toBeGreaterThan(0);
    expect(running.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
  });

  it('loops exactly one 1.6 s bar of the bed, whatever the decoder adds to the end', () => {
    startReelWhirr().stop();

    const [bed] = context().sources;
    expect(bed).toMatchObject({ loop: true, loopStart: 0, loopEnd: 1.6 });
  });

  it('steps the level down as reels stop and keeps the bed at its pitch and tempo', () => {
    const whirr = startReelWhirr();
    const [bed] = context().sources;

    whirr.setLevel(2 / 3);
    whirr.setLevel(1 / 3);

    expect(bed.level?.gain.setTargetAtTime.mock.calls.map((call) => call[0])).toEqual([
      expect.closeTo(0.2 * (2 / 3)),
      expect.closeTo(0.2 * (1 / 3)),
    ]);
    expect(bed.playbackRate.value).toBe(1);
    expect(bed.playbackRate.setValueAtTime).not.toHaveBeenCalled();
    expect(bed.playbackRate.setTargetAtTime).not.toHaveBeenCalled();
    whirr.stop();
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
  it('plays nothing, and never decodes the recordings a second time', async () => {
    warmSlotSounds();
    await Promise.resolve();

    expect(context().decodeAudioData).not.toHaveBeenCalled();
    expect(context().sources).toEqual([]);
  });
});
