import { beforeEach, describe, expect, it, vi } from 'vitest';
import { playLeverPull } from '../../../utils/slotSounds';
import { swingLever } from './swingLever';

vi.mock('../../../utils/slotSounds', () => ({ playLeverPull: vi.fn() }));

describe('swingLever', () => {
  const swing = vi.fn();
  const still = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs the ratchet and the thunk with the moving knob', () => {
    swingLever({ animate: true, swing, still });

    expect(playLeverPull).toHaveBeenCalledOnce();
    expect(swing).toHaveBeenCalledOnce();
    expect(still).not.toHaveBeenCalled();
  });

  it('pulls at once and silently with animations off', () => {
    swingLever({ animate: false, swing, still });

    expect(still).toHaveBeenCalledOnce();
    expect(swing).not.toHaveBeenCalled();
    expect(playLeverPull).not.toHaveBeenCalled();
  });

  it('keeps the machine’s own respin silent with animations off', () => {
    swingLever({ animate: false, swing });

    expect(swing).not.toHaveBeenCalled();
    expect(playLeverPull).not.toHaveBeenCalled();
  });
});
