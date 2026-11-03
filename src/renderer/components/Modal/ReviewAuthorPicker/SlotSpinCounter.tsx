import React from 'react';
import { t } from '@/shared/i18n/i18n';
import { AppNumberFlow } from '../../ui/AppNumberFlow';

interface SlotSpinCounterProps {
  // Unknown until the first lookup or spin answers
  spinsLeft: number | null;
}

// The spins the server still allows this machine this hour
export const SlotSpinCounter: React.FC<SlotSpinCounterProps> = ({ spinsLeft }) => (
  <span className="slot-credit" data-empty={spinsLeft === 0 || undefined}>
    <span>{t('reviewAuthorPicker.spins')}</span>
    {spinsLeft === null ? (
      <span className="slot-credit__value">--</span>
    ) : (
      <AppNumberFlow className="slot-credit__value" value={spinsLeft} />
    )}
  </span>
);
