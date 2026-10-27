let context: AudioContext | null = null;

// One context for every synthesised sound in the renderer
export function getAudioContext(): AudioContext {
  context ??= new AudioContext();
  // The autoplay policy can leave it suspended until the first gesture
  if (context.state === 'suspended') {
    void context.resume();
  }
  return context;
}
