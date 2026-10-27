import { vi } from 'vitest';

class FakeParam {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  setTargetAtTime = vi.fn();
  cancelAndHoldAtTime = vi.fn();
}

class FakeNode {
  connect<T>(target: T): T {
    return target;
  }
}

class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  type = 'sine';
  frequency = new FakeParam();
  start = vi.fn();
  stop = vi.fn();
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeFilter extends FakeNode {
  type = 'lowpass';
  frequency = new FakeParam();
  Q = new FakeParam();
}

// Records the sources a sound starts, so tests see whether anything played without a real audio stack
export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: 'running' | 'suspended' = 'running';
  currentTime = 0;
  sampleRate = 8000;
  destination = new FakeNode();
  sources: FakeSource[] = [];
  resume = vi.fn(() => Promise.resolve());

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  // The context the code under test opened last
  static latest(): FakeAudioContext {
    const context = FakeAudioContext.instances.at(-1);
    if (!context) {
      throw new Error('No audio context was opened');
    }
    return context;
  }

  createBuffer(_channels: number, length: number) {
    const samples = new Float32Array(length);
    return { getChannelData: () => samples };
  }

  createBufferSource() {
    return this.track(new FakeSource());
  }

  createOscillator() {
    return this.track(new FakeSource());
  }

  createGain() {
    return new FakeGain();
  }

  createBiquadFilter() {
    return new FakeFilter();
  }

  private track(source: FakeSource) {
    this.sources.push(source);
    return source;
  }
}
