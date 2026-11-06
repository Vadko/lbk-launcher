import { describe, expect, it } from 'vitest';
import { tooltipArrowLeft } from './tooltipArrowLeft';

describe('tooltipArrowLeft', () => {
  it('centres the arrow under a centred tooltip', () => {
    expect(tooltipArrowLeft('center', 48, 60)).toBe(30);
    expect(tooltipArrowLeft('center', 120, 60)).toBe(30);
  });

  it('points at the trigger from a tooltip aligned to its right edge', () => {
    expect(tooltipArrowLeft('left', 40, 200)).toBe(180);
  });

  it('points at the trigger from a tooltip aligned to its left edge', () => {
    expect(tooltipArrowLeft('right', 40, 200)).toBe(20);
  });

  it('keeps the arrow off the corners when the trigger is wider than the tooltip', () => {
    expect(tooltipArrowLeft('left', 300, 100)).toBe(8);
    expect(tooltipArrowLeft('right', 300, 100)).toBe(92);
  });
});
