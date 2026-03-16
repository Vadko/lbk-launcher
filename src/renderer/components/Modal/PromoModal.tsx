import { Bell, Heart } from 'lucide-react';
import supportBox from '@resources/images/promo-support-box.svg';
import React, { useEffect, useState } from 'react';
import { usePromoModalStore } from '../../store/usePromoModalStore';
import { trackEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Modal } from './Modal';

export const PromoModal: React.FC = () => {
  const { isOpen, closeModal, shouldShowModal, openModal } = usePromoModalStore();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Promo modal logic - show after delay based on dev mode
  useEffect(() => {
    const { devMode } = usePromoModalStore.getState();

    if (devMode === 'never') return;

    // Listen to dev mode changes and close modal if set to 'never'
    const unsubscribe = usePromoModalStore.subscribe((state) => {
      if (state.devMode === 'never' && state.isOpen) {
        state.closeModal(false);
      }
    });

    // Determine delay based on dev mode
    const getDelay = () => {
      if (devMode === 'always') return 1000; // 1 second for testing
      if (devMode === 'normal') return 10000; // 10 seconds for normal use
      return 0;
    };

    const delay = getDelay();

    if (delay > 0 && shouldShowModal()) {
      const timer = setTimeout(() => {
        if (shouldShowModal()) {
          openModal();
        }
      }, delay);

      return () => {
        clearTimeout(timer);
        unsubscribe();
      };
    }

    return unsubscribe;
  }, [shouldShowModal, openModal]);

  const handleClose = () => {
    if (dontShowAgain) {
      closeModal(true);
    } else {
      closeModal(false);
    }
  };

  const handlePrimaryAction = () => {
    // Open donation/support link
    if (window.electronAPI) {
      window.electronAPI.openExternal('https://send.monobank.ua/jar/48WhXBAEsM');
    }
    trackEvent('Promo Modal Support Click');

    if (dontShowAgain) {
      closeModal(true);
    } else {
      closeModal(false);
    }
  };

  const handleSecondaryAction = () => {
    // Copy share link
    navigator.clipboard?.writeText('https://lbk.space');
    trackEvent('Promo Modal Share Click');

    if (dontShowAgain) {
      closeModal(true);
    } else {
      closeModal(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} styleModal="promo">
      <div className="flex flex-col gap-6">
        {/* Картинка */}
        <div className="flex justify-center">
          <img src={supportBox} alt="Підтримайте український лаунчер!" width={190} height={184} />
          
        </div>

        {/* Текст та опис */}
        <div className="text-center space-y-3">
          <h3 className="text-xl font-head font-semibold text-text-main">
            Трохи підтримки для лаунчера?
          </h3>
          <p className="text-text-muted leading-relaxed">
            Ми розвиваємо цей лаунчер, щоб вам було зручно знаходити та завантажувати
            ігри. Покращуємо швидкість, стабільність і додаємо нові функції.
          </p>
          <div className="text-sm text-text-muted italic">
            Навіть маленький внесок має значення ✨
          </div>
        </div>

        {/* Чекбокс */}
        <div className="flex items-center justify-center gap-3">
          <Checkbox
            id="dont-show-again"
            checked={dontShowAgain}
            onCheckedChange={setDontShowAgain}
          />
          <label
            htmlFor="dont-show-again"
            className="text-sm text-text-muted cursor-pointer"
          >
            Більше не показувати
          </label>
        </div>

        {/* Кнопки */}
        <div className="flex gap-6 justify-center">
          <Button
            variant="primary"
            icon={<Heart size={20} />}
            onClick={handlePrimaryAction}
            data-gamepad-action
          >
            Задонатити
          </Button>
          <Button
            variant="accent"
            icon={<Bell size={20} />}
            onClick={handleSecondaryAction}
            data-gamepad-action
          >
            Підписатись
          </Button>
        </div>
      </div>
    </Modal>
  );
};
