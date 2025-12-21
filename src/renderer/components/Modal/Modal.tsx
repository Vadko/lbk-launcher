import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  showCloseButton = true,
}) => (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={onClose}
        >
          {/* Backdrop with blur */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-xl modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          />

          {/* Modal content */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="relative bg-[rgba(10,20,30,0.95)] border border-border rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col backdrop-blur-xl modal-content"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{
              duration: 0.2,
              ease: [0.23, 1, 0.32, 1],
            }}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
                <h3 id="modal-title" className="text-lg font-semibold text-text-main break-words">
                  {title}
                </h3>
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    data-gamepad-cancel
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-glass-hover transition-colors flex-shrink-0 ml-2"
                  >
                    <X size={18} className="text-text-muted" />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="p-6 overflow-y-auto break-words flex-1">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="p-6 border-t border-border flex-shrink-0">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
