import React from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';
import { Modal } from './Modal';
import { useModalStore } from '../../store/useModalStore';

export const GlobalModal: React.FC = () => {
  const { isOpen, config, closeModal } = useModalStore();

  if (!config) return null;

  const getIcon = () => {
    switch (config.type) {
      case 'success':
        return <CheckCircle size={48} className="text-green-400" />;
      case 'error':
        return <XCircle size={48} className="text-red-400" />;
      case 'info':
      default:
        return <Info size={48} className="text-neon-blue" />;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title={config.title}>
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-glass">
          {getIcon()}
        </div>
        <p className="text-text-muted whitespace-pre-line break-words">
          {config.message}
        </p>
        <div className="flex flex-col gap-2 w-full mt-2">
          {config.actions && config.actions.length > 0 ? (
            config.actions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  action.onClick();
                  closeModal();
                }}
                className={`w-full px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity ${
                  action.variant === 'secondary'
                    ? 'bg-glass-heavy text-white'
                    : 'bg-gradient-to-r from-neon-blue to-neon-purple text-white'
                }`}
              >
                {action.label}
              </button>
            ))
          ) : (
            <button
              onClick={closeModal}
              data-gamepad-confirm
              className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Зрозуміло
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
