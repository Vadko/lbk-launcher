import { Shield } from 'lucide-react';
import React from 'react';
import { Modal } from './Modal';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Політика приватності"
    footer={
      <button
        onClick={onClose}
        data-gamepad-confirm
        className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-color-accent to-color-main text-text-dark font-semibold hover:opacity-90 transition-opacity"
      >
        Зрозуміло
      </button>
    }
  >
    <div className="space-y-4 text-text-main">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
          <Shield size={24} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">LBK Launcher</h3>
          <p className="text-sm text-text-muted">Політика приватності</p>
        </div>
      </div>

      <section className="space-y-3">
        <p className="text-sm text-text-muted leading-relaxed">
          Ми цінуємо вашу приватність і збираємо лише ті дані, які необхідні для
          стабільної роботи продукту.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Які дані ми збираємо?</h4>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            <strong className="text-text-main">На сайті:</strong> Використовується{' '}
            <strong className="text-text-main">Google Analytics</strong> для аналізу
            трафіку, популярності ігор та ефективності інтерфейсу. Збираються стандартні
            технічні дані (тип браузера, країна, час перебування).
          </li>
          <li>
            <strong className="text-text-main">У десктоп-клієнті:</strong> Ми
            використовуємо <strong className="text-text-main">Mixpanel</strong> для
            відстеження технічних івентів (успішність завантаження файлів, помилки
            встановлення, версія ОС).
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Безпека та анонімність</h4>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            <strong className="text-text-main">Деанонімізація:</strong> Усі зібрані дані є
            анонімними. Ми не збираємо ваші імена, паролі чи платіжну інформацію.
          </li>
          <li>
            <strong className="text-text-main">Передача третім особам:</strong> Ми{' '}
            <strong className="text-text-main">не продаємо</strong> ваші дані. Технічна
            інформація передається лише аналітичним платформам (Google, Mixpanel) виключно
            для внутрішнього аналізу.
          </li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          <strong className="text-text-main">Прозорість:</strong> Ви завжди можете
          дізнатися, які саме івенти відправляє клієнт, вивчивши відкритий код фронтенду
          (GNU GPL v3).
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Контакти</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Якщо у вас є будь-які питання, звертайтесь:
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            <strong className="text-text-main">Email: </strong>
            <a
              target="_blank"
              href="mailto:pr@gameglobe-localisation.com"
              rel="noopener noreferrer"
              className="text-color-accent hover:text-color-main transition-colors underline"
            >
              pr@gameglobe-localisation.com
            </a>
          </li>
          <li>
            <strong className="text-text-main">Telegram: </strong>
            <a
              href="https://t.me/lbk_launcher_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-color-accent hover:text-color-main transition-colors underline"
            >
              https://t.me/lbk_launcher_bot
            </a>
          </li>
        </ul>
      </section>

      <div className="mt-6 p-4 rounded-lg bg-glass border border-border">
        <p className="text-xs text-text-muted text-center">
          Останнє оновлення: {new Date().toLocaleDateString('uk-UA')}
        </p>
      </div>
    </div>
  </Modal>
);
