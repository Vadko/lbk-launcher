import React from 'react';
import { Modal } from './Modal';
import { useConfirmStore } from '../../store/useConfirmStore';

export const ConfirmModal: React.FC = () => {
  const { isOpen, config, closeConfirm, confirm } = useConfirmStore();

  if (!config) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeConfirm}
      title={config.title}
      showCloseButton={false}
    >
      <div className="flex flex-col gap-6">
        <p className="text-white whitespace-pre-line">{config.message}</p>
        <div className="flex gap-3">
          <button
            onClick={closeConfirm}
            data-gamepad-cancel
            className="flex-1 px-6 py-3 rounded-xl bg-glass border border-border text-white font-semibold hover:bg-glass-hover transition-colors focus:outline-none focus:ring-2 focus:ring-neon-blue"
          >
            {config.cancelText || 'Скасувати'}
          </button>
          <button
            onClick={confirm}
            data-gamepad-confirm
            className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-white font-semibold hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-neon-blue"
          >
            {config.confirmText || 'Підтвердити'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
