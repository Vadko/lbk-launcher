import hold from '@resources/sounds/slot/hold.ogg?inline';
import leverThunk from '@resources/sounds/slot/lever-thunk.ogg?inline';
import payout from '@resources/sounds/slot/payout.ogg?inline';
import ratchet from '@resources/sounds/slot/ratchet.ogg?inline';
import reelSpin from '@resources/sounds/slot/reel-spin.ogg?inline';
import reelStop from '@resources/sounds/slot/reel-stop.ogg?inline';
import { getAudioContext } from './audioContext';
import { ratchetRun } from './ratchetRun';
import { uiSoundsEnabled } from './uiSoundsEnabled';

export interface ReelWhirr {
  // The share of the reels still spinning, from 0 to 1
  setLevel: (level: number) => void;
  stop: () => void;
}

const SILENT_WHIRR: ReelWhirr = { setLevel: () => undefined, stop: () => undefined };

// The clips (resources/sounds/slot/SOURCES.md), inlined as data URIs, which fetch reads even in the packaged file:// renderer
const CLIPS = { hold, leverThunk, payout, ratchet, reelSpin, reelStop };

type Clip = keyof typeof CLIPS;

const CLIP_NAMES = Object.keys(CLIPS) as Clip[];

const semitones = (steps: number): number => 2 ** (steps / 12);

const SILENCE = 0.0001;
// In step with the lever's 0.32 s pull, which speeds up as it drops
const RATCHET_AT = [0, 0.067, 0.127, 0.18, 0.227, 0.267];
// The clips are in E: the ticks climb the pentatonic scale from E to the E above, where the thunk lands
const RATCHET_RATE = [0, 2, 4, 7, 9, 12].map(semitones);
const RATCHET_GAIN = 0.35;
const THUNK_AT = 0.32;
// The stops rise root, major third, fifth, and the payout resolves them
const REEL_STOP_RATE = [0, 4, 7].map(semitones);
// Releasing a reel answers the hold a fourth lower
const HOLD_RELEASE_RATE = semitones(-5);
const SPIN_GAIN = 0.2;
// One bar at the clips' 150 BPM, the beat the reels stop on; a decode a few frames longer would drift off it every pass
const SPIN_LOOP_S = 1.6;
// A sound asked for while the recordings still decode plays late only by this much; later than that it would lag its motion
const LATE_S = 0.15;

const buffers = new Map<Clip, AudioBuffer>();
let loading: Promise<boolean> | null = null;
let nextToothAt = 0;

// Resolves false when decoding failed, and the next sound tries again
function loadClips(ctx: AudioContext): Promise<boolean> {
  loading ??= Promise.all(
    CLIP_NAMES.map(async (name) => {
      const response = await fetch(CLIPS[name]);
      buffers.set(name, await ctx.decodeAudioData(await response.arrayBuffer()));
    })
  ).then(
    () => true,
    (error: unknown) => {
      loading = null;
      console.error('[SlotSound] Failed to decode the recordings:', error);
      return false;
    }
  );
  return loading;
}

interface Hit {
  at: number;
  gain: number;
  rate?: number;
}

// A clip sped up is shorter and so sounds quieter; keeping its energy stops a rising figure from fading
const pitched = (at: number, gain: number, rate: number): Hit => ({
  at,
  gain: gain * Math.sqrt(rate),
  rate,
});

function hit(ctx: AudioContext, clip: Clip, { at, gain, rate = 1 }: Hit): void {
  const buffer = buffers.get(clip);
  if (!buffer) {
    return;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  // playbackRate is k-rate: set at a future time inside a render quantum, the clip's attack would play at the old rate
  source.playbackRate.value = rate;
  const level = ctx.createGain();
  level.gain.value = gain;
  source.connect(level).connect(ctx.destination);
  source.start(at);
}

// Opening the audio context takes over 100 ms and decoding a little more, which would otherwise stall the lever's first pull
export function warmSlotSounds(): void {
  if (!uiSoundsEnabled()) {
    return;
  }
  try {
    void loadClips(getAudioContext());
  } catch (error) {
    console.error('[SlotSound] Failed to open the audio context:', error);
  }
}

// A broken audio stack never gets in the way of the picker
function play(name: string, sound: (ctx: AudioContext, at: number) => void): void {
  if (!uiSoundsEnabled()) {
    return;
  }
  try {
    const ctx = getAudioContext();
    const askedAt = ctx.currentTime;
    if (buffers.size === CLIP_NAMES.length) {
      sound(ctx, askedAt);
      return;
    }
    void loadClips(ctx).then((loaded) => {
      if (loaded && ctx.currentTime - askedAt < LATE_S) {
        sound(ctx, ctx.currentTime);
      }
    });
  } catch (error) {
    console.error(`[SlotSound] Failed to play ${name}:`, error);
  }
}

// Teeth of the dragged lever passed together, 1 at the top to 6 at the bottom, all sounded within `withinS`
export function playRatchetRun(teeth: readonly number[], withinS: number): void {
  if (teeth.length === 0) {
    return;
  }
  play('ratchet', (ctx, now) => {
    const run = ratchetRun(now, nextToothAt, teeth.length, withinS);
    nextToothAt = run.free;
    teeth.forEach((tooth, index) =>
      hit(ctx, 'ratchet', pitched(run.at[index], RATCHET_GAIN, RATCHET_RATE[tooth - 1]))
    );
  });
}

// The lever hits the bottom of its travel
export const playLeverThunk = () =>
  play('thunk', (ctx, at) => hit(ctx, 'leverThunk', { at, gain: 0.45 }));

// A whole pull: the ticks run up the scale as the knob drops, then it bottoms out
export const playLeverPull = () =>
  play('lever', (ctx, at) => {
    RATCHET_AT.forEach((offset, index) =>
      hit(ctx, 'ratchet', pitched(at + offset, RATCHET_GAIN, RATCHET_RATE[index]))
    );
    hit(ctx, 'leverThunk', { at: at + THUNK_AT, gain: 0.45 });
  });

export const playReelStop = (reelIndex: number) =>
  play('reel stop', (ctx, at) =>
    hit(ctx, 'reelStop', pitched(at, 0.5, REEL_STOP_RATE[reelIndex]))
  );

export const playHoldClick = (on: boolean) =>
  play('hold', (ctx, at) =>
    hit(ctx, 'hold', { at, gain: 0.4, rate: on ? 1 : HOLD_RELEASE_RATE })
  );

// The payout, once the nickname is taken
export const playWinChime = () =>
  play('payout', (ctx, at) => hit(ctx, 'payout', { at, gain: 0.35 }));

// The spin bed, in time with the stops and a step quieter as each one lands; runs until stopped
export function startReelWhirr(): ReelWhirr {
  if (!uiSoundsEnabled()) {
    return SILENT_WHIRR;
  }
  try {
    const ctx = getAudioContext();
    const buffer = buffers.get('reelSpin');
    if (!buffer) {
      void loadClips(ctx);
      return SILENT_WHIRR;
    }
    const at = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = SPIN_LOOP_S;
    const level = ctx.createGain();
    level.gain.setValueAtTime(SILENCE, at);
    level.gain.linearRampToValueAtTime(SPIN_GAIN, at + 0.08);
    source.connect(level).connect(ctx.destination);
    source.start(at);

    return {
      setLevel: (share) => {
        const now = ctx.currentTime;
        level.gain.cancelAndHoldAtTime(now);
        level.gain.setTargetAtTime(SPIN_GAIN * share, now, 0.05);
      },
      stop: () => {
        const now = ctx.currentTime;
        level.gain.cancelAndHoldAtTime(now);
        level.gain.setTargetAtTime(SILENCE, now, 0.04);
        source.stop(now + 0.25);
      },
    };
  } catch (error) {
    console.error('[SlotSound] Failed to start the reel whirr:', error);
    return SILENT_WHIRR;
  }
}
