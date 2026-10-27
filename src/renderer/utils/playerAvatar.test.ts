import { describe, expect, it } from 'vitest';
import { playerAvatarUri } from './playerAvatar';

describe('playerAvatarUri', () => {
  it('draws an SVG data URI', () => {
    expect(playerAvatarUri('0a1b2c3d4e5f')).toMatch(/^data:image\/svg\+xml/);
  });

  it('draws the same avatar for a seed every time', () => {
    const first = playerAvatarUri('0a1b2c3d4e5f');
    // A cold cache must give the same art as a warm one
    for (let i = 0; i < 250; i++) {
      playerAvatarUri(i.toString(16).padStart(12, '0'));
    }
    expect(playerAvatarUri('0a1b2c3d4e5f')).toBe(first);
  });

  it('draws different avatars for different seeds', () => {
    expect(playerAvatarUri('0a1b2c3d4e5f')).not.toBe(playerAvatarUri('ffffffffffff'));
  });
});
