import { vi } from 'vitest';

class FakeParam {
  constructor(public value = 0) {}

  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  setTargetAtTime = vi.fn();
  cancelAndHoldAtTime = vi.fn();
}

class FakeNode {
  outputs: FakeNode[] = [];

  connect<T extends FakeNode>(target: T): T {
    this.outputs.push(target);
    return target;
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam(1);
}

class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  type = 'sine';
  frequency = new FakeParam();
  playbackRate = new FakeParam(1);
  start = vi.fn();
  stop = vi.fn();

  // The gain node this source plays through, which sets how loud it is
  get level(): FakeGain | undefined {
    return this.outputs.find((node) => node instanceof FakeGain);
  }
}

class FakeFilter extends FakeNode {
  type = 'lowpass';
  frequency = new FakeParam();
  Q = new FakeParam();
}

// Shaped like an AudioBuffer, one sample array per channel
function fakeBuffer(channels: number, length: number, sampleRate: number) {
  const data = Array.from({ length: channels }, () => new Float32Array(length));
  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (channel: number) => {
      const samples = channel >= 0 ? data.at(channel) : undefined;
      if (!samples) {
        throw new RangeError(`No channel ${channel} in a ${channels}-channel buffer`);
      }
      return samples;
    },
  };
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
  // The clips ship as stereo
  decodeAudioData = vi.fn((data: ArrayBuffer) =>
    Promise.resolve(fakeBuffer(2, data.byteLength, this.sampleRate))
  );

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

  createBuffer(channels: number, length: number) {
    return fakeBuffer(channels, length, this.sampleRate);
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
