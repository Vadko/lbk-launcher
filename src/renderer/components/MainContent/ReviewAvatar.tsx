import { type LucideIcon, ShieldCheckIcon, UserIcon, UsersIcon } from 'lucide-react';
import type { GameReviewAuthor } from '@/shared/game-reviews-types';
import { playerAvatarUri } from '../../utils/playerAvatar';

interface ReviewAvatarProps {
  author: GameReviewAuthor;
  size: number;
}

// A player gets a generated avatar once the server assigns the seed with the nickname
const ICON_AVATARS: Record<
  GameReviewAuthor['role'],
  { icon: LucideIcon; className: string }
> = {
  player: { icon: UserIcon, className: 'bg-glass border border-border text-text-muted' },
  author: { icon: UsersIcon, className: 'bg-color-main/20 text-color-main' },
  moderator: { icon: ShieldCheckIcon, className: 'bg-color-accent/20 text-color-accent' },
};

export function ReviewAvatar({ author, size }: ReviewAvatarProps) {
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
}
