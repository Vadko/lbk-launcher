import { Check, Send } from 'lucide';
import type { TurnstileAction } from '@/shared/game-reviews-api-types';
import { t } from '@/shared/i18n/i18n';
import { useActionPhase } from '../../hooks/useActionPhase';
import { useDraftFocusRequest } from '../../hooks/useDraftFocusRequest';
import { prefetchReviewCaptcha } from '../../queries/reviewsClient';
import { AppActionIcon } from '../ui/AppActionIcon';
import { Button } from '../ui/Button';

interface ReviewComposerProps {
  initialText?: string;
  // The draft's key in useReviewDraftsStore
  draftKey: string;
  // Held by the caller in a store, so a remount keeps what was typed
  text: string;
  onTextChange: (text: string) => void;
  submitLabel: string;
  captchaAction: TurnstileAction;
  // A public thread takes a captcha token, which main solves while the text is typed
  isPublic: boolean;
  // An edit's window closed on the server, so saving stops with it
  isExpired?: boolean;
  // A reply waits for the nickname picker and is false when it was called off; an edit goes out at once
  onSubmit: (text: string) => Promise<boolean> | undefined;
  onClose: () => void;
}

const MAX_LENGTH = 1000;

export function ReviewComposer({
  initialText = '',
  draftKey,
  text,
  onTextChange,
  submitLabel,
  captchaAction,
  isPublic,
  isExpired = false,
  onSubmit,
  onClose,
}: ReviewComposerProps) {
  // A draft shown again (a revisit, a language switch) must not take focus or scroll the page to itself
  const autoFocus = useDraftFocusRequest(draftKey);
  const submit = useActionPhase();
  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && trimmed !== initialText.trim() && !isExpired;

  const handleSubmit = async () => {
    if (!canSubmit || submit.isPending) {
      return;
    }
    // The caller closes the composer once the write went out
    const sending = onSubmit(trimmed);
    if (!sending) {
      return;
    }
    const sent = await submit.attempt(() => sending, { label: 'GameReviews' });
    if (sent === false) {
      submit.reset();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        onFocus={() => {
          if (isPublic) {
            prefetchReviewCaptcha(captchaAction);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose();
          }
        }}
        placeholder={t('gameReviews.replyPlaceholder')}
        maxLength={MAX_LENGTH}
        rows={3}
        autoFocus={autoFocus}
        data-gamepad-action
        className="w-full px-4 py-3 bg-glass border border-border rounded-lg text-sm text-text-main placeholder:text-text-muted outline-hidden transition-all duration-300 backdrop-blur-lg resize-none glass-input"
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          className="px-3! py-1.5! text-sm"
          onClick={onClose}
          data-gamepad-action
        >
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          className="px-4! py-1.5! min-h-0! rounded-full! text-sm gap-2!"
          icon={
            <AppActionIcon
              phase={submit.phase}
              icon={initialText ? Check : Send}
              size={16}
            />
          }
          disabled={!canSubmit}
          aria-busy={submit.isPending}
          onClick={() => void handleSubmit()}
          data-gamepad-action
        >
          {submitLabel}
        </Button>
      </div>
      {submit.phase === 'error' && (
        <p className="text-xs text-red-400">{t('gameReviews.actionFailed')}</p>
      )}
    </div>
  );
}
