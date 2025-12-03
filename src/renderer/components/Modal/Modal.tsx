import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl"
      onClick={onClose}
    >
      <div
        className="bg-[rgba(10,20,30,0.95)] border border-border rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
          <h3 className="text-lg font-semibold text-white break-words">{title}</h3>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-glass-hover transition-colors flex-shrink-0 ml-2"
            >
              <X size={18} className="text-text-muted" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto break-words">{children}</div>
      </div>
    </div>
  );
};
