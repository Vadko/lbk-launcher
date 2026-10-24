import { describe, expect, it } from 'vitest';
import { mayReplaceModal } from './steamBridge';

describe('mayReplaceModal', () => {
  const progress = { title: 'Restarting Steam', message: '…' };

  it('replaces its own progress modal or an empty slot', () => {
    expect(mayReplaceModal(progress, progress)).toBe(true);
    expect(mayReplaceModal(null, progress)).toBe(true);
  });

  it('never replaces a modal another flow opened meanwhile', () => {
    expect(
      mayReplaceModal({ title: 'Running the installer', message: '…' }, progress)
    ).toBe(false);
  });
});
