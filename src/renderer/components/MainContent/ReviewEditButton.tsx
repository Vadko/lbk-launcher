import { PencilIcon } from 'lucide-react';
import { t } from '@/shared/i18n/i18n';
import { Button } from '../ui/Button';
import { REVIEW_ACTION } from './reviewActionClass';

interface ReviewEditButtonProps {
  minutesLeft: number;
  disabled: boolean;
  onClick: () => void;
}

export function ReviewEditButton({
  minutesLeft,
  disabled,
  onClick,
}: ReviewEditButtonProps) {
  return (
    <Button
      variant="ghost"
      className={REVIEW_ACTION}
      icon={<PencilIcon size={14} />}
      disabled={disabled}
      onClick={onClick}
      data-gamepad-action
    >
      {t('gameReviews.edit')}
      <span className="text-xs font-normal text-text-muted">
        · {t('gameReviews.editTimeLeft', { minutes: minutesLeft })}
      </span>
    </Button>
  );
}
