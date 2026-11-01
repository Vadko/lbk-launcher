import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioContext } from './fakeAudioContext.fixture';

vi.stubGlobal('AudioContext', FakeAudioContext);

const freshModule = () => {
  vi.resetModules();
  return import('./audioContext');
};

describe('getAudioContext', () => {
  beforeEach(() => {
    FakeAudioContext.instances = [];
  });

  it('opens one context and hands it to every caller', async () => {
    const { getAudioContext } = await freshModule();

    expect(getAudioContext()).toBe(getAudioContext());
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it.each([
    ['resumes a suspended context', 'suspended', 1],
    ['leaves a running context alone', 'running', 0],
  ] as const)('%s', async (_label, state, resumes) => {
    const { getAudioContext } = await freshModule();
    getAudioContext();
    const context = FakeAudioContext.latest();
    context.state = state;

    getAudioContext();

    expect(context.resume).toHaveBeenCalledTimes(resumes);
  });
});
