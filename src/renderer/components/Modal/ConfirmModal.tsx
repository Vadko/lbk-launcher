import React from 'react';
import { t } from '@/shared/i18n/i18n';
import { useConfirmStore } from '../../store/useConfirmStore';
import { Button } from '../ui/Button';
import { Modal } from './Modal';

export const ConfirmModal: React.FC = () => {
  const { isOpen, config, closeConfirm, confirm } = useConfirmStore();

  if (!config) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeConfirm}
      title={config.title}
      showCloseButton={false}
    >
      <div className="flex flex-col gap-6">
        <p className="text-text-main whitespace-pre-line">{config.message}</p>
        <div className="flex gap-3">
          <Button
            onClick={closeConfirm}
            variant="secondary"
            data-gamepad-cancel
            className="flex-1"
          >
            {config.cancelText || t('common.cancel')}
          </Button>
          <Button
            onClick={confirm}
            variant="primary"
            data-gamepad-confirm
            className="flex-1"
          >
            {config.confirmText || t('confirmModal.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
