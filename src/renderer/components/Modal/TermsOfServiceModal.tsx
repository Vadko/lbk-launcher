import { FileTextIcon } from 'lucide-react';
import React from 'react';
import { Trans } from 'react-i18next';
import { t } from '@/shared/i18n/i18n';
import { Modal } from './Modal';

interface TermsOfServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LINK_CLASS = 'text-color-accent hover:text-color-main transition-colors underline';

const markup = { b: <strong className="text-text-main" /> };

export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({
  isOpen,
  onClose,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={t('termsOfService.title')}
    footer={
      <button
        onClick={onClose}
        data-gamepad-confirm
        className="w-full px-6 py-3 rounded-xl bg-linear-to-r/srgb from-color-accent to-color-main text-text-dark font-semibold hover:opacity-90 transition-opacity"
      >
        {t('common.ok')}
      </button>
    }
  >
    <div className="space-y-4 text-text-main">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-linear-to-br/srgb from-color-accent to-color-main flex items-center justify-center shrink-0">
          <FileTextIcon size={24} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">LBK Launcher</h3>
          <p className="text-sm text-text-muted">{t('termsOfService.subtitle')}</p>
        </div>
      </div>

      <section className="space-y-3">
        <p className="text-sm text-text-muted leading-relaxed">
          <Trans
            i18nKey="termsOfService.intro"
            components={{
              ...markup,
              site: (
                <a
                  href="https://lbklauncher.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${LINK_CLASS} ml-1`}
                />
              ),
            }}
          />
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          <Trans i18nKey="termsOfService.parties" components={markup} />
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold">
          {t('termsOfService.sections.definitions.title')}
        </h4>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            <Trans
              i18nKey="termsOfService.sections.definitions.country"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="termsOfService.sections.definitions.service"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="termsOfService.sections.definitions.website"
              components={{
                ...markup,
                site: (
                  <a
                    href="https://ggloc.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${LINK_CLASS} ml-1`}
                  />
                ),
              }}
            />
          </li>
          <li>
            <Trans
              i18nKey="termsOfService.sections.definitions.you"
              components={markup}
            />
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold">
          {t('termsOfService.sections.licensing.title')}
        </h4>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            <Trans
              i18nKey="termsOfService.sections.licensing.frontend"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="termsOfService.sections.licensing.backend"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="termsOfService.sections.licensing.content"
              components={markup}
            />
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold">
          {t('termsOfService.sections.liability.title')}
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('termsOfService.sections.liability.text')}
        </p>
        <p className="text-sm text-text-main font-semibold leading-relaxed">
          {t('termsOfService.sections.liability.risk')}
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold">
          {t('termsOfService.sections.contacts.title')}
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('termsOfService.sections.contacts.intro')}
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            <strong className="text-text-main">Email: </strong>
            <a
              target="_blank"
              href="mailto:pr@gameglobe-localisation.com"
              rel="noopener noreferrer"
              className={LINK_CLASS}
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
              className={LINK_CLASS}
            >
              https://t.me/lbk_launcher_bot
            </a>
          </li>
        </ul>
      </section>

      <div className="p-4 rounded-lg bg-glass border border-border">
        <p className="text-xs text-text-muted text-center">
          {t('termsOfService.lastUpdated')}
        </p>
      </div>
    </div>
  </Modal>
);
