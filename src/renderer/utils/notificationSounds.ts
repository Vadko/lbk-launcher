import type { ToastNotification } from '../store/subscriptions/types';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * Play a pleasant chime sound for status changes (green theme)
 * Musical: C5 -> E5 -> G5 arpeggio
 */
function playStatusChangeSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5

  frequencies.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, now);

    gainNode.gain.setValueAtTime(0, now + i * 0.08);
    gainNode.gain.linearRampToValueAtTime(0.15, now + i * 0.08 + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(now + i * 0.08);
    oscillator.stop(now + i * 0.08 + 0.35);
  });
}

/**
 * Play an uplifting notification sound for version updates (blue theme)
 * Musical: G4 -> C5 -> E5 rising
 */
function playVersionUpdateSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const frequencies = [392, 523.25, 659.25]; // G4, C5, E5

  frequencies.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(freq, now);

    gainNode.gain.setValueAtTime(0, now + i * 0.1);
    gainNode.gain.linearRampToValueAtTime(0.12, now + i * 0.1 + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(now + i * 0.1);
    oscillator.stop(now + i * 0.1 + 0.45);
  });
}

/**
 * Play a special notification sound for app updates (purple theme)
 * Musical: E4 -> G4 -> B4 -> E5 fanfare
 */
function playAppUpdateSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const frequencies = [329.63, 392, 493.88, 659.25]; // E4, G4, B4, E5

  frequencies.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, now);

    gainNode.gain.setValueAtTime(0, now + i * 0.12);
    gainNode.gain.linearRampToValueAtTime(0.1, now + i * 0.12 + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(now + i * 0.12);
    oscillator.stop(now + i * 0.12 + 0.55);
  });
}

/**
 * Play a progress notification sound (amber theme)
 * Musical: Rising sweep with harmonics - like a level up
 */
function playProgressChangeSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Main rising sweep
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(400, now);
  osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
  gain1.gain.setValueAtTime(0, now);
  gain1.gain.linearRampToValueAtTime(0.12, now + 0.02);
  gain1.gain.setValueAtTime(0.12, now + 0.15);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.4);

  // Sparkle overlay - quick high notes
  const sparkleNotes = [1046.5, 1318.5, 1568]; // C6, E6, G6
  sparkleNotes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0, now + i * 0.05 + 0.1);
    gain.gain.linearRampToValueAtTime(0.06, now + i * 0.05 + 0.11);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.05 + 0.1);
    osc.stop(now + i * 0.05 + 0.25);
  });
}

/**
 * Play a sparkling sound for new team game (yellow theme)
 * Musical: High sparkle C6 -> G6 -> C7
 */
function playTeamNewGameSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const frequencies = [1046.5, 1567.98, 2093]; // C6, G6, C7

  frequencies.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, now);

    gainNode.gain.setValueAtTime(0, now + i * 0.06);
    gainNode.gain.linearRampToValueAtTime(0.08, now + i * 0.06 + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.25);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(now + i * 0.06);
    oscillator.stop(now + i * 0.06 + 0.3);
  });
}

/**
 * Play a notification sound for team status change (cyan theme)
 * Musical: Two-tone notification D5 -> A5
 */
function playTeamStatusChangeSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const frequencies = [587.33, 880]; // D5, A5

  frequencies.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(freq, now);

    gainNode.gain.setValueAtTime(0, now + i * 0.12);
    gainNode.gain.linearRampToValueAtTime(0.1, now + i * 0.12 + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(now + i * 0.12);
    oscillator.stop(now + i * 0.12 + 0.35);
  });
}

/**
 * Play notification sound based on notification type
 */
export function playNotificationSound(type: ToastNotification['type']): void {
  try {
    switch (type) {
      case 'status-change':
        playStatusChangeSound();
        break;
      case 'version-update':
        playVersionUpdateSound();
        break;
      case 'app-update':
        playAppUpdateSound();
        break;
      case 'progress-change':
        playProgressChangeSound();
        break;
      case 'team-new-game':
        playTeamNewGameSound();
        break;
      case 'team-status-change':
        playTeamStatusChangeSound();
        break;
      default:
        playStatusChangeSound();
    }
  } catch (error) {
    console.error('[NotificationSound] Failed to play sound:', error);
  }
}
