import React from 'react';
import { t } from '@/shared/i18n/i18n';
import { NOTICE_TONE, type PickerNotice } from './pickerNotice';

interface SlotMessageDisplayProps {
  notice: PickerNotice | null;
  // The claimed name, which the display then flashes
  wonName: string | null;
  canPull: boolean;
  animate: boolean;
}

// Wishes luck whenever the machine is busy: spinning, landing or checking a claim
const runningText = (wonName: string | null, canPull: boolean): string => {
  if (wonName !== null) {
    return wonName;
  }
  return t(canPull ? 'reviewAuthorPicker.led.idle' : 'reviewAuthorPicker.led.spinning');
};

// The dot-matrix display in the cabinet's crown: a notice stands still, the rest scrolls past
export const SlotMessageDisplay: React.FC<SlotMessageDisplayProps> = ({
  notice,
  wonName,
  canPull,
  animate,
}) => {
  const text = notice === null ? runningText(wonName, canPull) : null;
  const effect = wonName !== null ? 'slot-led__text--blink' : 'slot-led__text--run';

  return (
    <div className="slot-crown">
      <div
        className="slot-led"
        data-tone={notice === null ? undefined : NOTICE_TONE[notice]}
        data-won={wonName !== null || undefined}
      >
        <div className="slot-led__screen">
          <p className="slot-led__notice" aria-live="polite">
            {notice && t(`reviewAuthorPicker.notice.${notice}`)}
          </p>
          {text !== null && (
            <span key={text} className="slot-led__line" aria-hidden>
              <span className={`slot-led__text ${animate ? effect : ''}`}>{text}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
