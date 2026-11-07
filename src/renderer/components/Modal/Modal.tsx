import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from 'lucide-react';
import React from 'react';
import { createPortal } from 'react-dom';
import { getTopDialog } from '../../utils/getTopDialog';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  // A line under the title in the header
  description?: string;
  // The header runs into the body with no divider, as one card
  seamlessHeader?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showCloseButton?: boolean;
  styleModal?: 'normal' | 'promo';
  usePortal?: boolean;
  classNames?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  seamlessHeader = false,
  children,
  footer,
  showCloseButton = true,
  styleModal = 'normal',
  usePortal = false,
  classNames = '',
}) => {
  // Stacked dialogs each need their own title id, or a screen reader names them all after the first
  const titleId = React.useId();
  const descriptionId = React.useId();
  const hasDescription = styleModal === 'normal' && !!description;

  const dialogRef = React.useRef<HTMLDivElement>(null);

  // Every open modal listens on window, so only the top dialog takes the Escape
  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dialogRef.current === getTopDialog()) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const content = (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={onClose}
        >
          {/* Backdrop with blur */}
          <motion.div
            className={`absolute inset-0  backdrop-blur-xl modal-backdrop ${styleModal === 'promo' ? 'bg-black/90' : 'bg-black/60'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          />

          {/* Modal content */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={styleModal === 'normal' && title ? titleId : undefined}
            aria-describedby={hasDescription ? descriptionId : undefined}
            className={`relative max-w-200 w-full mx-4 max-h-[90vh] flex flex-col backdrop-blur-xl modal-content
            ${classNames}
            ${styleModal === 'promo' ? 'glass-card glass-card-gold p-0! overflow-hidden min-h-100' : 'bg-[rgb(15,15,16)] rounded-2xl modal-gradient-border'}`}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{
              duration: 0.2,
              ease: [0.23, 1, 0.32, 1],
            }}
          >
            {styleModal === 'normal' ? (
              <>
                {/* Header */}
                {(title || showCloseButton) && (
                  <div
                    className={`flex justify-between shrink-0 ${seamlessHeader ? 'px-6 pt-6' : 'p-6 border-b border-white/10'} ${hasDescription ? 'items-start' : 'items-center'}`}
                  >
                    <div className="min-w-0">
                      <h3
                        id={titleId}
                        className={`text-lg font-semibold text-text-main wrap-break-word ${seamlessHeader ? 'leading-[1.3]' : ''}`}
                      >
                        {title}
                      </h3>
                      {hasDescription && (
                        <p
                          id={descriptionId}
                          className="mt-1 text-[13px] leading-[1.3] text-text-muted"
                        >
                          {description}
                        </p>
                      )}
                    </div>
                    {showCloseButton && (
                      <button
                        onClick={onClose}
                        data-gamepad-cancel
                        // B closes the dialog, so the gamepad never stops on the X
                        data-gamepad-skip
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-glass-hover transition-colors shrink-0 ml-2"
                      >
                        <XIcon size={18} className="text-text-muted" />
                      </button>
                    )}
                  </div>
                )}

                {/* Content */}
                <div
                  className={`overflow-y-auto wrap-break-word flex-1 ${seamlessHeader ? 'px-6 pt-4.5 pb-6' : 'p-6'}`}
                >
                  {children}
                </div>

                {/* Footer */}
                {footer && (
                  <div className="p-6 border-t border-border shrink-0">{footer}</div>
                )}
              </>
            ) : (
              <>
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    data-gamepad-cancel
                    className="absolute top-8 right-8 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-glass-hover transition-colors"
                  >
                    <XIcon size={18} className="text-text-muted" />
                  </button>
                )}
                {/* Content */}
                <div className="overflow-y-auto wrap-break-word flex-1">{children}</div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return usePortal
    ? createPortal(content, document.getElementById('root') ?? document.body)
    : content;
};
