import { Avatar, Style } from '@dicebear/core';
import shapeGrid from '@dicebear/styles/shape-grid.json';
import { F } from '@mobily/ts-belt';
import { type LucideIcon, ShieldCheckIcon, UserIcon, UsersIcon } from 'lucide-react';
import React from 'react';
import type { GameReviewAuthor } from '@/shared/game-reviews-types';

interface ReviewAvatarProps {
  author: GameReviewAuthor;
  size: number;
}

const SHAPE_GRID = new Style(shapeGrid);

// The launcher's three accents alone give one in three players the same disc
const PASTELS = [
  '#ffa47a',
  '#a8cf96',
  '#efeead',
  '#9cc7ec',
  '#c4b2f2',
  '#f4a8b8',
  '#8fd3c7',
];

const playerAvatarUri = F.memoizeWithKey(
  (seed: string) => seed,
  (seed: string) =>
    new Avatar(SHAPE_GRID, {
      seed,
      borderRadius: 50,
      backgroundColor: PASTELS,
      backgroundColorFill: 'linear',
      backgroundColorFillStops: 2,
      backgroundColorAngle: [0, 360],
      shapeColor: ['#18181b'],
    }).toDataUri()
);

// A player gets a generated avatar once the server assigns the seed with the nickname
const ICON_AVATARS: Record<
  GameReviewAuthor['role'],
  { icon: LucideIcon; className: string }
> = {
  player: { icon: UserIcon, className: 'bg-glass border border-border text-text-muted' },
  author: { icon: UsersIcon, className: 'bg-color-main/20 text-color-main' },
  moderator: { icon: ShieldCheckIcon, className: 'bg-color-accent/20 text-color-accent' },
};

export const ReviewAvatar: React.FC<ReviewAvatarProps> = ({ author, size }) => {
  if (author.role === 'player' && author.avatarSeed) {
    return (
      <img
        src={playerAvatarUri(author.avatarSeed)}
        alt=""
        className="shrink-0 rounded-full"
        style={{ width: size, height: size }}
      />
    );
  }
  const { icon: Icon, className } = ICON_AVATARS[author.role];
  return (
    <span
      aria-hidden
      className={`shrink-0 flex items-center justify-center rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size / 2)} />
    </span>
  );
};
