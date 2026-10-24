import { ShieldIcon } from 'lucide-react';
import React from 'react';
import { Trans } from 'react-i18next';
import { t } from '@/shared/i18n/i18n';
import { Modal } from './Modal';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LINK_CLASS = 'text-color-accent hover:text-color-main transition-colors underline';

const LEGAL_BASIS_ROWS = [
  { purpose: 'delivery', category: 'essential', basis: 'requestOrTerms' },
  { purpose: 'subscription', category: 'essential', basis: 'request' },
  { purpose: 'abuse', category: 'essential', basis: 'stability' },
  {
    purpose: 'improve',
    category: 'improve',
    basis: 'legitimateInterest',
  },
  {
    purpose: 'develop',
    category: 'develop',
    basis: 'legitimateInterest',
  },
  {
    purpose: 'diagnostics',
    category: 'diagnostics',
    basis: 'legitimateInterest',
  },
  { purpose: 'feedback', category: 'userAction', basis: 'consent' },
  { purpose: 'account', category: 'account', basis: 'requestOrTerms' },
] as const;

const markup = {
  b: <strong className="text-text-main" />,
  mail: (
    <a
      href="mailto:pr@gameglobe-localisation.com"
      target="_blank"
      rel="noopener noreferrer"
      className={LINK_CLASS}
    />
  ),
  tg: (
    <a
      href="https://t.me/lbk_launcher_bot"
      target="_blank"
      rel="noopener noreferrer"
      className={LINK_CLASS}
    />
  ),
};

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={t('privacyPolicy.title')}
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
    <div className="space-y-5 text-text-main">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-linear-to-br/srgb from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
          <ShieldIcon size={24} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">LBK Launcher</h3>
          <p className="text-sm text-text-muted">{t('privacyPolicy.updated')}</p>
        </div>
      </div>

      <section className="space-y-3">
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.intro')}
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.openSource')}
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.controller.title')}
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          <Trans
            i18nKey="privacyPolicy.sections.controller.responsible"
            components={markup}
          />
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.controller.contactsIntro')}
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.controller.email"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.controller.telegram"
              components={markup}
            />
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.categories.title')}
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.categories.intro')}
        </p>
        <h5 className="text-sm font-semibold text-text-main">
          {t('privacyPolicy.sections.categories.essentialTitle')}
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.categories.essentialText')}
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.categories.essentialListIntro')}
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>{t('privacyPolicy.sections.categories.essential1')}</li>
          <li>{t('privacyPolicy.sections.categories.essential2')}</li>
          <li>{t('privacyPolicy.sections.categories.essential3')}</li>
          <li>{t('privacyPolicy.sections.categories.essential4')}</li>
          <li>{t('privacyPolicy.sections.categories.essential5')}</li>
        </ul>
        <h5 className="text-sm font-semibold text-text-main">
          {t('privacyPolicy.sections.categories.improveTitle')}
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.categories.improveText')}
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.categories.improveListIntro')}
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>{t('privacyPolicy.sections.categories.improve1')}</li>
          <li>{t('privacyPolicy.sections.categories.improve2')}</li>
          <li>{t('privacyPolicy.sections.categories.improve3')}</li>
          <li>{t('privacyPolicy.sections.categories.improve4')}</li>
        </ul>
        <h5 className="text-sm font-semibold text-text-main">
          {t('privacyPolicy.sections.categories.developTitle')}
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.categories.developText')}
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.categories.developListIntro')}
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>{t('privacyPolicy.sections.categories.develop1')}</li>
          <li>{t('privacyPolicy.sections.categories.develop2')}</li>
          <li>{t('privacyPolicy.sections.categories.develop3')}</li>
          <li>{t('privacyPolicy.sections.categories.develop4')}</li>
        </ul>
        <h5 className="text-sm font-semibold text-text-main">
          {t('privacyPolicy.sections.categories.diagnosticsTitle')}
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.categories.diagnosticsText')}
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.categories.optOut')}
        </p>
        <h5 className="text-sm font-semibold text-text-main">
          {t('privacyPolicy.sections.categories.publicTitle')}
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.categories.publicText')}
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.categories.noTracking')}
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.localOnly.title')}
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.localOnly.intro')}
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.localOnly.gameDetection"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.localOnly.platformAccounts"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.localOnly.steamLibrary"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.localOnly.localDb"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.localOnly.backups"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.localOnly.search"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.localOnly.thirdPartySync"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.localOnly.playtime"
              components={markup}
            />
          </li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.localOnly.outro')}
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.network.title')}
        </h4>
        <h5 className="text-sm font-semibold text-text-main">
          {t('privacyPolicy.sections.network.downloadTitle')}
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.network.downloadIntro')}
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>{t('privacyPolicy.sections.network.download1')}</li>
          <li>{t('privacyPolicy.sections.network.download2')}</li>
          <li>{t('privacyPolicy.sections.network.download3')}</li>
          <li>{t('privacyPolicy.sections.network.download4')}</li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.network.downloadPurpose')}
        </p>
        <h5 className="text-sm font-semibold text-text-main">
          {t('privacyPolicy.sections.network.workshopTitle')}
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.network.workshopText')}
        </p>
        <h5 className="text-sm font-semibold text-text-main">
          {t('privacyPolicy.sections.network.subscriptionTitle')}
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.network.subscriptionText')}
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.productAnalytics.title')}
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.productAnalytics.intro')}
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.productAnalytics.sessions"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.productAnalytics.firstSession"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.productAnalytics.mixpanel"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.productAnalytics.banners"
              components={markup}
            />
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.localizationAnalytics.title')}
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.localizationAnalytics.intro')}
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.localizationAnalytics.support"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.localizationAnalytics.emptySearch"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.localizationAnalytics.uninstall"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.localizationAnalytics.playtime"
              components={markup}
            />
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.feedback.title')}
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.feedback.intro')}
        </p>
        <h5 className="text-sm font-semibold text-text-main">
          {t('privacyPolicy.sections.feedback.feedbackTitle')}
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.feedback.feedbackIntro')}
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>{t('privacyPolicy.sections.feedback.feedback1')}</li>
          <li>{t('privacyPolicy.sections.feedback.feedback2')}</li>
          <li>{t('privacyPolicy.sections.feedback.feedback3')}</li>
          <li>{t('privacyPolicy.sections.feedback.feedback4')}</li>
          <li>{t('privacyPolicy.sections.feedback.feedback5')}</li>
          <li>{t('privacyPolicy.sections.feedback.feedback6')}</li>
        </ul>
        <h5 className="text-sm font-semibold text-text-main">
          {t('privacyPolicy.sections.feedback.screenshotsTitle')}
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.feedback.screenshotsText')}
        </p>
        <h5 className="text-sm font-semibold text-text-main">
          {t('privacyPolicy.sections.feedback.logsTitle')}
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.feedback.logsText')}
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.crashReports.title')}
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.crashReports.text')}
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.crashReports.optIn')}
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          <Trans
            i18nKey="privacyPolicy.sections.crashReports.glitchTip"
            components={markup}
          />
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.website.title')}
        </h4>
        <h5 className="text-sm font-semibold text-text-main">
          {t('privacyPolicy.sections.website.publicTitle')}
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          <Trans i18nKey="privacyPolicy.sections.website.zaraz" components={markup} />
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.website.emptySearch')}
        </p>
        <h5 className="text-sm font-semibold text-text-main">
          {t('privacyPolicy.sections.website.videoTitle')}
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.website.videoText')}
        </p>
        <h5 className="text-sm font-semibold text-text-main">
          {t('privacyPolicy.sections.website.releasesTitle')}
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.website.releasesText')}
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.accounts.title')}
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.accounts.intro')}
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.accounts.dataIntro')}
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>{t('privacyPolicy.sections.accounts.data1')}</li>
          <li>{t('privacyPolicy.sections.accounts.data2')}</li>
          <li>{t('privacyPolicy.sections.accounts.data3')}</li>
          <li>{t('privacyPolicy.sections.accounts.data4')}</li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.accounts.googleAnalytics')}
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.legalBasis.title')}
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-muted">
            <thead>
              <tr>
                <th scope="col" className="p-2">
                  {t('privacyPolicy.sections.legalBasis.columns.purpose')}
                </th>
                <th scope="col" className="p-2">
                  {t('privacyPolicy.sections.legalBasis.columns.category')}
                </th>
                <th scope="col" className="p-2">
                  {t('privacyPolicy.sections.legalBasis.columns.basis')}
                </th>
              </tr>
            </thead>
            <tbody>
              {LEGAL_BASIS_ROWS.map((row) => (
                <tr key={row.purpose} className="border-t border-border">
                  <td className="p-2 align-top">
                    {t(`privacyPolicy.sections.legalBasis.purposes.${row.purpose}`)}
                  </td>
                  <td className="p-2 align-top">
                    {t(`privacyPolicy.sections.legalBasis.categories.${row.category}`)}
                  </td>
                  <td className="p-2 align-top">
                    {t(`privacyPolicy.sections.legalBasis.bases.${row.basis}`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.legalBasis.objection')}
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.retention.title')}
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.retention.text')}
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.retention.details')}
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.recipients.title')}
        </h4>
        <h5 className="text-sm font-semibold text-text-main">
          {t('privacyPolicy.sections.recipients.infraTitle')}
        </h5>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.recipients.supabase"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.recipients.glitchTip"
              components={markup}
            />
          </li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.recipients.coolify')}
        </p>
        <h5 className="text-sm font-semibold text-text-main">
          {t('privacyPolicy.sections.recipients.externalTitle')}
        </h5>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.recipients.mixpanel"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.recipients.zaraz"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.recipients.googleAnalytics"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.recipients.resend"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.recipients.youtube"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.recipients.steam"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.recipients.github"
              components={markup}
            />
          </li>
          <li>
            <Trans
              i18nKey="privacyPolicy.sections.recipients.teamChannels"
              components={markup}
            />
          </li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.recipients.partners')}
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.steamFallback.title')}
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.steamFallback.text')}
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.steamFallback.notStored')}
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.location.title')}
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          <Trans i18nKey="privacyPolicy.sections.location.servers" components={markup} />
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.location.external')}
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.rights.title')}
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.rights.intro')}
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>{t('privacyPolicy.sections.rights.access')}</li>
          <li>{t('privacyPolicy.sections.rights.rectify')}</li>
          <li>{t('privacyPolicy.sections.rights.erase')}</li>
          <li>{t('privacyPolicy.sections.rights.object')}</li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          <Trans i18nKey="privacyPolicy.sections.rights.requests" components={markup} />
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.rights.identification')}
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.security.title')}
        </h4>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>{t('privacyPolicy.sections.security.roles')}</li>
          <li>{t('privacyPolicy.sections.security.storage')}</li>
          <li>{t('privacyPolicy.sections.security.passwords')}</li>
          <li>{t('privacyPolicy.sections.security.tokens')}</li>
          <li>{t('privacyPolicy.sections.security.secrets')}</li>
          <li>{t('privacyPolicy.sections.security.encryption')}</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.limits.title')}
        </h4>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>{t('privacyPolicy.sections.limits.sell')}</li>
          <li>{t('privacyPolicy.sections.limits.account')}</li>
          <li>{t('privacyPolicy.sections.limits.screenshots')}</li>
          <li>{t('privacyPolicy.sections.limits.clipboard')}</li>
          <li>{t('privacyPolicy.sections.limits.machineId')}</li>
          <li>{t('privacyPolicy.sections.limits.ads')}</li>
          <li>{t('privacyPolicy.sections.limits.fingerprinting')}</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.changes.title')}
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          {t('privacyPolicy.sections.changes.text')}
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          {t('privacyPolicy.sections.contacts.title')}
        </h4>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>
            <strong className="text-text-main">Email:</strong>{' '}
            <a
              href="mailto:pr@gameglobe-localisation.com"
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_CLASS}
            >
              pr@gameglobe-localisation.com
            </a>
          </li>
          <li>
            <strong className="text-text-main">Telegram:</strong>{' '}
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
    </div>
  </Modal>
);
