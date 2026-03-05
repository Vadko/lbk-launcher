import { FileText } from 'lucide-react';
import React from 'react';
import { Modal } from './Modal';

interface TermsOfServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({
  isOpen,
  onClose,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Умови використання"
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
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-color-accent to-color-main flex items-center justify-center flex-shrink-0">
          <FileText size={24} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">LBK Launcher</h3>
          <p className="text-sm text-text-muted">Умови використання послуги</p>
        </div>
      </div>

      <section className="space-y-3">
        <p className="text-sm text-text-muted leading-relaxed">
          Ці Умови регулюють використання сайту
          <a
            href="https://lbklauncher.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-color-accent hover:text-color-main transition-colors underline ml-1"
          >
            lbklauncher.com
          </a>{' '}
          та десктопного клієнта <strong className="text-text-main">LBK Launcher</strong>.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          <strong className="text-text-main">Сторони:</strong> LBK Team (GameGlobe
          Localization та Little Bit) та Користувач "ви", продуктів LBK Team - сайту та
          десктоп клієнту (ланчеру).
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Визначення та ключові терміни</h4>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            <strong className="text-text-main">Країна:</strong> країна, де розташована LBK
            Team або її власники/засновники, у цьому випадку — Україна.
          </li>
          <li>
            <strong className="text-text-main">Сервіс:</strong> послуга, яку надає
            GameGlobe Localization (вул. Металістів, 4, Київ, 02000) та Little Bit, як
            описано у відповідних умовах (якщо доступно) та на цій платформі.
          </li>
          <li>
            <strong className="text-text-main">Вебсайт:</strong> сайт GameGlobe
            Localization, доступний за URL:
            <a
              href="https://ggloc.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-color-accent hover:text-color-main transition-colors underline ml-1"
            >
              https://ggloc.org/
            </a>
            .
          </li>
          <li>
            <strong className="text-text-main">Ви:</strong> особа або організація, що
            користуються сервісами від GameGlobe Localization та Little Bit для
            використання Сервісів.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">
          Ліцензування та інтелектуальна власність
        </h4>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            <strong className="text-text-main">Front-end клієнта:</strong> Вихідний код
            графічного інтерфейсу та клієнтської частини є відкритим і поширюється під
            ліцензією <strong className="text-text-main">GNU GPL v3</strong>. Ви маєте
            право модифікувати та поширювати його згідно з умовами цієї ліцензії.
          </li>
          <li>
            <strong className="text-text-main">Back-end та API:</strong> Вся серверна
            частина, бази даних та логіка API є виключною інтелектуальною власністю{' '}
            <strong className="text-text-main">LBK Team</strong>. Будь-які спроби
            несанкціонованого доступу, брутфорсу, реверс-інжинірингу серверних протоколів
            або втручання в роботу серверної інфраструктури{' '}
            <strong className="text-text-main">суворо заборонені</strong>.
          </li>
          <li>
            <strong className="text-text-main">Контент (Переклади):</strong> Усі
            локалізації, доступні в лаунчері, за ліцензією для кінцевого користувача з
            обмеженням лише для некомерційного приватного використання. Вони призначені
            виключно для особистого ознайомлення та некомерційного використання. Ви не
            маєте права перепродавати або використовувати ці файли у комерційних продуктах
            без дозволу правовласників.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Обмеження відповідальності</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Програмне забезпечення надається за принципом "as is" (як є). LBK Team не несе
          відповідальності за можливі конфлікти з античитами ігор, технічні збої або
          втрату ігрового прогресу, спричинені встановленням перекладів.
        </p>
        <p className="text-sm text-text-main font-semibold leading-relaxed">
          ВИ ВИКОРИСТОВУЄТЕ ЛАУНЧЕР НА ВЛАСНИЙ РИЗИК. МИ НЕ ГАРАНТУЄМО ВІДСУТНІСТЬ БАНІВ В
          ОНЛАЙН-ІГРАХ
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
