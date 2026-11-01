import { Check, Send } from 'lucide';
import React, { useEffect, useRef, useState } from 'react';
import type { TurnstileAction } from '@/shared/game-reviews-api-types';
import { t } from '@/shared/i18n/i18n';
import { useActionPhase } from '../../hooks/useActionPhase';
import { usePrefetchCaptcha } from '../../hooks/usePrefetchCaptcha';
import { AppActionIcon } from '../ui/AppActionIcon';
import { Button } from '../ui/Button';

interface ReviewComposerProps {
  initialText?: string;
  submitLabel: string;
  captchaAction: TurnstileAction;
  // A public thread takes a captcha token, which main solves while the text is typed
  isPublic: boolean;
  // An edit's window closed on the server, so saving stops with it
  isExpired?: boolean;
  // False when the write was called off before it went out; the signal aborts once the composer is closed
  onSubmit: (text: string, signal: AbortSignal) => Promise<boolean>;
  onClose: () => void;
}

const MAX_LENGTH = 1000;

export const ReviewComposer: React.FC<ReviewComposerProps> = ({
  initialText = '',
  submitLabel,
  captchaAction,
  isPublic,
  isExpired = false,
  onSubmit,
  onClose,
}) => {
  usePrefetchCaptcha(captchaAction, isPublic);
  const [text, setText] = useState(initialText);
  const submit = useActionPhase();
  const pendingSubmit = useRef<AbortController | null>(null);
  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && trimmed !== initialText.trim() && !isExpired;

  // A reply waiting for the nickname must not go out once its composer is gone
  useEffect(() => () => pendingSubmit.current?.abort(), []);

  const close = () => {
    pendingSubmit.current?.abort();
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit || submit.isPending) {
      return;
    }
    const controller = new AbortController();
    pendingSubmit.current = controller;
    // The caller closes the composer, so it can do that in the render that shows the result
    const sent = await submit.attempt(() => onSubmit(trimmed, controller.signal), {
      label: 'GameReviews',
    });
    if (sent === false) {
      submit.reset();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            close();
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
          onClick={close}
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
