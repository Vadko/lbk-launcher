import { F } from '@mobily/ts-belt';

// One context for every sound in the renderer; a failed construction is retried on the next sound
const sharedContext = F.once(() => new AudioContext());

export function getAudioContext(): AudioContext {
  const context = sharedContext();
  // The autoplay policy can leave it suspended until the first gesture
  if (context.state === 'suspended') {
    void context.resume();
  }
  return context;
}
