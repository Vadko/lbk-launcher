import { getAudioContext } from './audioContext';
import { uiSoundsEnabled } from './uiSoundsEnabled';

export interface ReelWhirr {
  // The share of the reels still spinning, from 0 to 1
  setLevel: (level: number) => void;
  stop: () => void;
}

const SILENT_WHIRR: ReelWhirr = { setLevel: () => undefined, stop: () => undefined };

const WHIRR_GAIN = 0.05;
const SILENCE = 0.0001;
// In step with the lever's 0.32 s pull, which speeds up as it drops
const RATCHET_AT = [0, 0.067, 0.127, 0.18, 0.227, 0.267];
const THUNK_AT = 0.32;
const BELL_HZ = 1180;
const BELL_STRIKES = 10;
const BELL_STEP = 0.06;
const BELL_DECAY = 0.35;
// A struck bell's partials are not harmonics, which is what makes it ring rather than beep
const BELL_PARTIALS = [
  { ratio: 1, gain: 0.07 },
  { ratio: 2.76, gain: 0.035 },
  { ratio: 5.4, gain: 0.02 },
  { ratio: 8.93, gain: 0.01 },
];
const COIN_AT = [0.1, 0.28, 0.46];

const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();

function noiseOf(ctx: AudioContext): AudioBuffer {
  const known = noiseBuffers.get(ctx);
  if (known) {
    return known;
  }
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index++) {
    samples[index] = Math.random() * 2 - 1;
  }
  noiseBuffers.set(ctx, buffer);
  return buffer;
}

interface Burst {
  at: number;
  frequency: number;
  q: number;
  gain: number;
  decay: number;
  filter?: BiquadFilterType;
}

// Filtered noise hit: a ratchet tooth, a latch, the rattle of a stopping reel
function burst(
  ctx: AudioContext,
  { at, frequency, q, gain, decay, filter = 'bandpass' }: Burst
) {
  const source = ctx.createBufferSource();
  source.buffer = noiseOf(ctx);
  const band = ctx.createBiquadFilter();
  band.type = filter;
  band.frequency.setValueAtTime(frequency, at);
  band.Q.setValueAtTime(q, at);
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(gain, at);
  envelope.gain.exponentialRampToValueAtTime(SILENCE, at + decay);
  source.connect(band).connect(envelope).connect(ctx.destination);
  source.start(at, Math.random() * 0.5);
  source.stop(at + decay + 0.02);
}

interface Tone {
  at: number;
  from: number;
  to: number;
  gain: number;
  decay: number;
  type?: OscillatorType;
}

function tone(ctx: AudioContext, { at, from, to, gain, decay, type = 'sine' }: Tone) {
  const oscillator = ctx.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, at);
  oscillator.frequency.exponentialRampToValueAtTime(to, at + decay);
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(SILENCE, at);
  envelope.gain.linearRampToValueAtTime(gain, at + 0.004);
  envelope.gain.exponentialRampToValueAtTime(SILENCE, at + decay);
  oscillator.connect(envelope).connect(ctx.destination);
  oscillator.start(at);
  oscillator.stop(at + decay + 0.02);
}

// Opening the audio context takes over 100 ms, which would otherwise stall the lever's first pull
export function warmSlotSounds(): void {
  if (!uiSoundsEnabled()) {
    return;
  }
  try {
    noiseOf(getAudioContext());
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
    sound(ctx, ctx.currentTime);
  } catch (error) {
    console.error(`[SlotSound] Failed to play ${name}:`, error);
  }
}

const ratchet = (ctx: AudioContext, at: number, gain: number) => {
  burst(ctx, { at, frequency: 3200, q: 6, gain, decay: 0.025 });
  tone(ctx, { at, from: 1900, to: 1300, gain: gain / 5, decay: 0.02, type: 'square' });
};

const thunk = (ctx: AudioContext, at: number) => {
  tone(ctx, { at, from: 115, to: 46, gain: 0.22, decay: 0.17 });
  burst(ctx, { at, frequency: 480, q: 0.7, gain: 0.12, decay: 0.08, filter: 'lowpass' });
  burst(ctx, { at, frequency: 1500, q: 3, gain: 0.05, decay: 0.04 });
};

// One tooth of the lever's ratchet, while it is dragged
export const playRatchetClick = () =>
  play('ratchet', (ctx, at) => ratchet(ctx, at, 0.14));

// The lever hits the bottom of its travel
export const playLeverThunk = () => play('thunk', thunk);

// A whole pull: the ratchet runs faster as the arm drops, then the arm bottoms out
export const playLeverPull = () =>
  play('lever', (ctx, at) => {
    RATCHET_AT.forEach((offset, index) =>
      ratchet(ctx, at + offset, 0.09 + index * 0.012)
    );
    thunk(ctx, at + THUNK_AT);
  });

export const playReelStop = () =>
  play('reel stop', (ctx, at) => {
    tone(ctx, { at, from: 165, to: 70, gain: 0.16, decay: 0.11 });
    burst(ctx, { at, frequency: 900, q: 2, gain: 0.12, decay: 0.05 });
    burst(ctx, { at: at + 0.006, frequency: 2600, q: 4, gain: 0.05, decay: 0.03 });
  });

export const playHoldClick = () =>
  play('hold', (ctx, at) => {
    tone(ctx, { at, from: 1300, to: 880, gain: 0.05, decay: 0.035, type: 'triangle' });
    burst(ctx, { at, frequency: 4000, q: 3, gain: 0.05, decay: 0.02 });
  });

// The payout: the machine's bell rings on and coins drop into the tray
export const playWinChime = () =>
  play('payout', (ctx, at) => {
    for (let strike = 0; strike < BELL_STRIKES; strike++) {
      for (const { ratio, gain } of BELL_PARTIALS) {
        const frequency = BELL_HZ * ratio;
        tone(ctx, {
          at: at + strike * BELL_STEP,
          from: frequency,
          to: frequency,
          gain,
          decay: BELL_DECAY,
        });
      }
    }
    for (const offset of COIN_AT) {
      burst(ctx, { at: at + offset, frequency: 5200, q: 12, gain: 0.08, decay: 0.03 });
    }
  });

// Band-passed noise chopped by a sawtooth, the ticking hum of the reels; runs until stopped
export function startReelWhirr(): ReelWhirr {
  if (!uiSoundsEnabled()) {
    return SILENT_WHIRR;
  }
  try {
    const ctx = getAudioContext();
    const at = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noiseOf(ctx);
    source.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(700, at);
    band.Q.setValueAtTime(0.9, at);
    const flutter = ctx.createGain();
    flutter.gain.setValueAtTime(0.6, at);
    const tick = ctx.createOscillator();
    tick.type = 'sawtooth';
    tick.frequency.setValueAtTime(26, at);
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0.4, at);
    const level = ctx.createGain();
    level.gain.setValueAtTime(SILENCE, at);
    level.gain.linearRampToValueAtTime(WHIRR_GAIN, at + 0.12);
    tick.connect(depth).connect(flutter.gain);
    source.connect(band).connect(flutter).connect(level).connect(ctx.destination);
    source.start(at);
    tick.start(at);

    let stopped = false;
    return {
      setLevel: (share) => {
        if (stopped) {
          return;
        }
        const now = ctx.currentTime;
        level.gain.cancelAndHoldAtTime(now);
        level.gain.setTargetAtTime(WHIRR_GAIN * share, now, 0.05);
        tick.frequency.setTargetAtTime(14 + 12 * share, now, 0.1);
      },
      stop: () => {
        if (stopped) {
          return;
        }
        stopped = true;
        const now = ctx.currentTime;
        level.gain.cancelAndHoldAtTime(now);
        level.gain.setTargetAtTime(SILENCE, now, 0.04);
        source.stop(now + 0.25);
        tick.stop(now + 0.25);
      },
    };
  } catch (error) {
    console.error('[SlotSound] Failed to start the reel whirr:', error);
    return SILENT_WHIRR;
  }
}
