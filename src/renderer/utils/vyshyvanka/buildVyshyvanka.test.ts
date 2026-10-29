import { describe, expect, it } from 'vitest';
import { buildVyshyvanka } from './buildVyshyvanka';

describe('buildVyshyvanka', () => {
  // `pnpm build:avatar-style` rewrites the file through this test; a failed guard throws before anything is written
  it('passes every guard and reproduces the committed style byte for byte', async () => {
    await expect(buildVyshyvanka()).toMatchFileSnapshot('../vyshyvanka.json');
  }, 60_000);
});
