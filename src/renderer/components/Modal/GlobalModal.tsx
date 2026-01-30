import { CheckCircle, Info, XCircle } from 'lucide-react';
import React from 'react';
import { useModalStore } from '../../store/useModalStore';
import { SelectDropdown } from '../ui/SelectDropdown';
import { Modal } from './Modal';

export const GlobalModal: React.FC = () => {
  const { isOpen, config, closeModal } = useModalStore();

  if (!config) return null;

  const getIcon = () => {
    switch (config.type) {
      case 'success':
        return <CheckCircle size={48} className="text-color-main" />;
      case 'error':
        return <XCircle size={48} className="text-red-400" />;
      case 'info':
      default:
        return <Info size={48} className="text-color-accent" />;
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

        {/* Dropdown selection if selectConfig is provided */}
        {config.selectConfig && (
          <div className="w-full space-y-2">
            <label className="block text-sm font-medium text-text-main text-left">
              {config.selectConfig.placeholder || 'Оберіть варіант'}:
            </label>
            <SelectDropdown
              options={config.selectConfig.options}
              selectedValue={config.selectConfig.selectedValue}
              onSelectionChange={config.selectConfig.onSelectionChange || (() => {})}
              placeholder={config.selectConfig.placeholder}
              className="w-full"
            />
          </div>
        )}

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
                    : 'bg-gradient-to-r from-color-accent to-color-main text-text-dark'
                }`}
              >
                {action.label}
              </button>
            ))
          ) : (
            <button
              onClick={closeModal}
              data-gamepad-confirm
              className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-color-accent to-color-main text-text-dark font-semibold hover:opacity-90 transition-opacity"
            >
              Зрозуміло
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
