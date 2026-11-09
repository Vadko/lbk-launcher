import type { NicknameSpin } from '@/shared/game-reviews-api-types';
import { t } from '@/shared/i18n/i18n';
import { playerAvatarUri } from '../../../utils/playerAvatar';
import { type NicknameFont, nicknameFitStyle } from './nicknameFitStyle';
import { SlotSpinCounter } from './SlotSpinCounter';

const NAME_FONT: NicknameFont = { weight: 600, sizePx: 16 };

interface SlotResultProps {
  // Shown once the reels are at rest; null until the first spin lands
  spin: NicknameSpin | null;
  isSpinning: boolean;
  spinsLeft: number | null;
}

// The name and the avatar the reels show, as they would sign a review
export function SlotResult({ spin, isSpinning, spinsLeft }: SlotResultProps) {
  const shown = isSpinning ? null : spin;

  return (
    <div className="slot-result">
      {shown ? (
        <img
          src={playerAvatarUri(shown.avatarSeed)}
          alt=""
          className="slot-result__avatar"
        />
      ) : (
        <span className="slot-result__avatar" />
      )}
      <p className="slot-result__name" aria-live="polite">
        {shown && (
          <span style={nicknameFitStyle(shown.name, NAME_FONT)}>{shown.name}</span>
        )}
        {isSpinning && (
          <span className="slot-result__pending">
            {t('reviewAuthorPicker.generating')}
          </span>
        )}
      </p>
      <SlotSpinCounter spinsLeft={spinsLeft} />
    </div>
  );
}
