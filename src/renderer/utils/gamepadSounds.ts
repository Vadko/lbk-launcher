import { useSettingsStore } from '../store/useSettingsStore';

interface PlayOptions {
  /** Skip the gamepadSoundsEnabled + document.hasFocus checks (used by settings preview buttons). */
  ignoreSettings?: boolean;
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

function shouldPlay(opts?: PlayOptions): boolean {
  if (opts?.ignoreSettings) return true;
  if (!document.hasFocus()) return false;
  return useSettingsStore.getState().gamepadSoundsEnabled;
}

/** Soft click when moving between items. */
export function playNavigateSound(opts?: PlayOptions): void {
  if (!shouldPlay(opts)) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1200, now);
    oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.05);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.08, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.1);
  } catch (error) {
    console.error('[GamepadSound] Failed to play navigate sound:', error);
  }
}

/** Positive confirmation: two quick ascending tones (C5 → E5). */
export function playConfirmSound(opts?: PlayOptions): void {
  if (!shouldPlay(opts)) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    [523.25, 659.25].forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, now);

      gainNode.gain.setValueAtTime(0, now + i * 0.08);
      gainNode.gain.linearRampToValueAtTime(0.1, now + i * 0.08 + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.12);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(now + i * 0.08);
      oscillator.stop(now + i * 0.08 + 0.15);
    });
  } catch (error) {
    console.error('[GamepadSound] Failed to play confirm sound:', error);
  }
}

/** Back/cancel: descending tone. */
export function playBackSound(opts?: PlayOptions): void {
  if (!shouldPlay(opts)) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, now);
    oscillator.frequency.exponentialRampToValueAtTime(350, now + 0.1);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.08, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.15);
  } catch (error) {
    console.error('[GamepadSound] Failed to play back sound:', error);
  }
}
