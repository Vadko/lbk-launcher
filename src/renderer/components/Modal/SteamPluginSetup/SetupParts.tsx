import { LoaderCircle } from 'lucide';
import React, { useEffect } from 'react';
import { t } from '@/shared/i18n/i18n';
import type { SteamPluginSetupSource } from '../../../store/useSteamPluginSetupStore';
import { AppActionIcon } from '../../ui/AppActionIcon';
import { AppNumberFlow } from '../../ui/AppNumberFlow';
import { Modal } from '../Modal';

const noop = () => undefined;

export interface SetupView {
  title: string;
  dismissable: boolean;
  body: React.ReactNode;
  footer: React.ReactNode;
}

interface SetupFrameProps {
  view: SetupView;
  onClose: () => void;
}

// Each flow renders exactly one frame and swaps its view, so the Modal and its AnimatePresence stay mounted across steps.
export const SetupFrame: React.FC<SetupFrameProps> = ({ view, onClose }) => {
  const { title, dismissable, body, footer } = view;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      // Capture phase: the dialogs underneath (settings, install options) also close on a window-level Escape.
      event.stopPropagation();
      event.preventDefault();
      if (dismissable) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [dismissable, onClose]);

  return (
    <Modal
      isOpen
      onClose={dismissable ? onClose : noop}
      title={title}
      showCloseButton={dismissable}
      footer={footer}
    >
      {body}
    </Modal>
  );
};

const TONE_CLASSES = {
  primary: 'bg-linear-to-r/srgb from-color-accent to-color-main text-text-dark',
  secondary: 'bg-glass border border-border text-text-main hover:bg-glass-hover',
  danger: 'bg-red-500/80 text-white',
} as const;

interface SetupButtonProps {
  tone: keyof typeof TONE_CLASSES;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  busy?: boolean;
  gamepad?: 'confirm' | 'cancel';
  children: React.ReactNode;
}

export const SetupButton: React.FC<SetupButtonProps> = ({
  tone,
  onClick,
  icon,
  disabled = false,
  busy = false,
  gamepad,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-busy={busy || undefined}
    data-gamepad-modal-item
    data-gamepad-confirm={gamepad === 'confirm' || undefined}
    data-gamepad-cancel={gamepad === 'cancel' || undefined}
    className={`flex w-full min-w-0 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-wait sm:w-auto sm:flex-1 ${TONE_CLASSES[tone]}`}
  >
    {icon && <span className="inline-flex shrink-0 items-center">{icon}</span>}
    <span className="min-w-0 text-center">{children}</span>
  </button>
);

interface SetupFooterProps {
  children: React.ReactNode;
}

export const SetupFooter: React.FC<SetupFooterProps> = ({ children }) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{children}</div>
);

interface SetupProgressProps {
  text: string;
  percent: number | null;
}

export const SetupProgress: React.FC<SetupProgressProps> = ({ text, percent }) => (
  <div className="flex flex-col items-center gap-4 py-4 text-center" aria-live="polite">
    <AppActionIcon phase="pending" icon={LoaderCircle} size={32} />
    <p className="text-text-main">
      {text}
      {percent !== null && (
        <>
          {' '}
          <AppNumberFlow value={percent} suffix="%" />
        </>
      )}
    </p>
    {percent !== null && (
      <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-glass border border-border">
        <div
          className="h-full rounded-full bg-linear-to-r/srgb from-color-accent to-color-main transition-[width] duration-300"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    )}
  </div>
);

interface SetupTextProps {
  paragraphs: readonly string[];
}

export const SetupText: React.FC<SetupTextProps> = ({ paragraphs }) => (
  <div className="flex flex-col gap-3 text-sm text-text-muted">
    {paragraphs.map((paragraph) => (
      <p key={paragraph} className="whitespace-pre-line">
        {paragraph}
      </p>
    ))}
  </div>
);

interface SetupNoteProps {
  text: string | null;
}

export const SetupNote: React.FC<SetupNoteProps> = ({ text }) =>
  text ? <p className="mt-3 text-sm text-text-main wrap-break-word">{text}</p> : null;

interface SetupCloseProps {
  onClose: () => void;
}

export const SetupCloseButton: React.FC<SetupCloseProps> = ({ onClose }) => (
  <SetupButton tone="secondary" onClick={onClose} gamepad="cancel">
    {t('common.close')}
  </SetupButton>
);

export const SetupDoneButton: React.FC<SetupCloseProps> = ({ onClose }) => (
  <SetupButton tone="primary" onClick={onClose} gamepad="confirm">
    {t('common.ok')}
  </SetupButton>
);

interface OfferDismissButtonsProps {
  source: SteamPluginSetupSource;
  onClose: () => void;
  // Omitted where declining makes no sense, e.g. for an update.
  onDecline?: () => void;
}

export const OfferDismissButtons: React.FC<OfferDismissButtonsProps> = ({
  source,
  onClose,
  onDecline,
}) => (
  <>
    <SetupButton tone="secondary" onClick={onClose} gamepad="cancel">
      {source === 'offer' ? t('common.notNow') : t('common.cancel')}
    </SetupButton>
    {source === 'offer' && onDecline && (
      <SetupButton tone="secondary" onClick={onDecline}>
        {t('common.dontOfferAgain')}
      </SetupButton>
    )}
  </>
);
