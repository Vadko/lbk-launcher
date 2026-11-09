import { t } from '@/shared/i18n/i18n';
import { NOTICE_TONE, type PickerNotice } from './pickerNotice';

interface SlotStatusLineProps {
  notice: PickerNotice | null;
  // Every reel is held while the knob would otherwise take a pull
  showReleaseHint: boolean;
}

// The text under the result: a notice, how to free the knob, or both; the live region stays mounted so either is announced
export function SlotStatusLine({ notice, showReleaseHint }: SlotStatusLineProps) {
  return (
    <div className="slot-status" aria-live="polite">
      {notice && (
        <p data-tone={NOTICE_TONE[notice]}>{t(`reviewAuthorPicker.notice.${notice}`)}</p>
      )}
      {showReleaseHint && <p>{t('reviewAuthorPicker.releaseOne')}</p>}
    </div>
  );
}
