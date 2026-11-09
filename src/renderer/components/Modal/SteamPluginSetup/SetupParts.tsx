import { LoaderCircle } from 'lucide';
import { useEffect } from 'react';
import { t } from '@/shared/i18n/i18n';
import type { SteamPluginSetupSource } from '../../../store/useSteamPluginSetupStore';
import { AppActionIcon } from '../../ui/AppActionIcon';
import { AppNumberFlow } from '../../ui/AppNumberFlow';
import { Modal } from '../Modal';

const noop = () => undefined;

export interface SetupView {
  title: string;
  // A line under the title, which the dialog is also described by
  description?: string;
  dismissable: boolean;
  body: React.ReactNode;
  footer: React.ReactNode;
}

interface SetupFrameProps {
  view: SetupView;
  // Sizes or skins the dialog box itself
  className?: string;
  seamlessHeader?: boolean;
  onClose: () => void;
}

// Each flow renders exactly one frame and swaps its view, so the Modal and its AnimatePresence stay mounted across steps.
export function SetupFrame({
  view,
  className,
  seamlessHeader,
  onClose,
}: SetupFrameProps) {
  const { title, description, dismissable, body, footer } = view;

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
      description={description}
      seamlessHeader={seamlessHeader}
      showCloseButton={dismissable}
      footer={footer}
      classNames={className}
    >
      {body}
    </Modal>
  );
}

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

export function SetupButton({
  tone,
  onClick,
  icon,
  disabled = false,
  busy = false,
  gamepad,
  children,
}: SetupButtonProps) {
  return (
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
}

interface SetupFooterProps {
  children: React.ReactNode;
}

export function SetupFooter({ children }: SetupFooterProps) {
  return <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{children}</div>;
}

interface SetupProgressProps {
  text: string;
  percent: number | null;
}

export function SetupProgress({ text, percent }: SetupProgressProps) {
  return (
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
}

interface SetupTextProps {
  paragraphs: readonly string[];
}

export function SetupText({ paragraphs }: SetupTextProps) {
  return (
    <div className="flex flex-col gap-3 text-sm text-text-muted">
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

interface SetupNoteProps {
  text: string | null;
}

export function SetupNote({ text }: SetupNoteProps) {
  return text ? (
    <p className="mt-3 text-sm text-text-main wrap-break-word">{text}</p>
  ) : null;
}

interface SetupCloseProps {
  onClose: () => void;
}

export function SetupCloseButton({ onClose }: SetupCloseProps) {
  return (
    <SetupButton tone="secondary" onClick={onClose} gamepad="cancel">
      {t('common.close')}
    </SetupButton>
  );
}

export function SetupDoneButton({ onClose }: SetupCloseProps) {
  return (
    <SetupButton tone="primary" onClick={onClose} gamepad="confirm">
      {t('common.ok')}
    </SetupButton>
  );
}

interface OfferDismissButtonsProps {
  source: SteamPluginSetupSource;
  onClose: () => void;
  // Omitted where declining makes no sense, e.g. for an update.
  onDecline?: () => void;
}

export function OfferDismissButtons({
  source,
  onClose,
  onDecline,
}: OfferDismissButtonsProps) {
  return (
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
}
