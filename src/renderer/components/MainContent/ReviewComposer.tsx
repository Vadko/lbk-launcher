import { Check, Send } from 'lucide';
import React, { useState } from 'react';
import type { TurnstileAction } from '@/main/turnstile/contract';
import { t } from '@/shared/i18n/i18n';
import { useActionPhase } from '../../hooks/useActionPhase';
import { useNow } from '../../hooks/useNow';
import { usePrefetchCaptcha } from '../../hooks/usePrefetchCaptcha';
import { AppActionIcon } from '../ui/AppActionIcon';
import { Button } from '../ui/Button';

interface ReviewComposerProps {
  initialText?: string;
  submitLabel: string;
  captchaAction: TurnstileAction;
  // A public thread takes a captcha token, which main solves while the text is typed
  isPublic: boolean;
  // An edit closes on the server at this moment, so saving stops with it
  expiresAt?: number;
  onSubmit: (text: string) => Promise<void>;
  onClose: () => void;
}

const MAX_LENGTH = 1000;

export const ReviewComposer: React.FC<ReviewComposerProps> = ({
  initialText = '',
  submitLabel,
  captchaAction,
  isPublic,
  expiresAt,
  onSubmit,
  onClose,
}) => {
  usePrefetchCaptcha(captchaAction, isPublic);
  const [text, setText] = useState(initialText);
  const submit = useActionPhase();
  const now = useNow(10_000, expiresAt ?? 0);
  const trimmed = text.trim();
  const canSubmit =
    trimmed.length > 0 &&
    trimmed !== initialText.trim() &&
    (expiresAt === undefined || now < expiresAt);

  const handleSubmit = async () => {
    if (!canSubmit || submit.isPending) {
      return;
    }
    // The caller closes the composer, so it can do that in the render that shows the result
    await submit.attempt(
      async () => {
        await onSubmit(trimmed);
        return true;
      },
      { label: 'GameReviews' }
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose();
          }
        }}
        placeholder={t('gameReviews.replyPlaceholder')}
        maxLength={MAX_LENGTH}
        rows={3}
        autoFocus
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
};
