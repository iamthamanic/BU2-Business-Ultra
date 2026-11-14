/**
 * Finance accounts & rules tab panel.
 * Location: apps/web/src/features/finance/screens/FinanceAccounts.tsx
 */
import {
  Lightning,
} from '@phosphor-icons/react'
import { useI18n } from '../../../lib/i18n'
import { formatEur, type FinanceSnapshot } from '../financeModel'
import { FinanceConnectHint, Tag, useFinance } from './financeScreenShared'

export function FinanceAccounts({
  settingsHref,
  data,
}: {
  settingsHref: string
  data?: FinanceSnapshot
}) {
  const { t } = useI18n()
  const snap = useFinance(data)
  const accounts = snap.accounts
  const hasAccounts = accounts.length > 0
  return (
    <div className="finance-screen stack">
      <div className="finance-toolbar">
        <div>
          <h2 className="finance-small-title">{t('financeAccountsTitle')}</h2>
          <p className="finance-pagehint">{t('financeAccountsHint')}</p>
        </div>
        <Tag>{hasAccounts ? t('financeAccountsLinked') : t('financeNoBankYet')}</Tag>
      </div>

      {!hasAccounts ? <FinanceConnectHint settingsHref={settingsHref} /> : null}

      {hasAccounts ? (
        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{t('financeLinkedAccounts')}</h2>
              <p>{t('financeLinkedAccountsHint')}</p>
            </div>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {accounts.map((a) => (
              <div key={a.id} className="finance-switch-row">
                <div>
                  <strong>{a.name}</strong>
                  <p>
                    {[a.bankName, a.iban].filter(Boolean).join(' · ') || a.source}
                  </p>
                </div>
                <span className="finance-status-mini num">
                  {formatEur(a.balanceCents / 100, 2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="finance-two-column">
        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{t('financeSources')}</h2>
              <p>{t('financeSourcesHint')}</p>
            </div>
          </div>
          <div className="finance-switch-row">
            <div>
              <strong>{t('financeBankCard')}</strong>
              <p>{t('financeBankCardHint')}</p>
            </div>
            <span className="finance-status-mini">
              {hasAccounts ? t('financeConnected') : t('financeToConnect')}
            </span>
          </div>
          <div className="finance-switch-row">
            <div>
              <strong>{t('financeInvoices')}</strong>
              <p>{t('financeInvoicesHint')}</p>
            </div>
            <span className="finance-status-mini">{t('financeToConnect')}</span>
          </div>
          <div className="finance-switch-row">
            <div>
              <strong>{t('financeInternalLinks')}</strong>
              <p>{t('financeInternalLinksHint')}</p>
            </div>
            <Tag tone="blue">{t('financeInternalMap')}</Tag>
          </div>
          <div className="finance-switch-row">
            <div>
              <strong>{t('financeCurrencies')}</strong>
              <p>{t('financeCurrenciesHint')}</p>
            </div>
            <span className="finance-status-mini">EUR</span>
          </div>
        </div>

        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{t('financeRulesReserves')}</h2>
              <p>{t('financeRulesHint')}</p>
            </div>
          </div>
          <div className="finance-switch-row">
            <div>
              <strong>{t('financeTaxReserve')}</strong>
              <p>{t('financeTaxReserveHintEmpty')}</p>
            </div>
            <Tag tone="amber">{t('financeManual')}</Tag>
          </div>
          <div className="finance-switch-row">
            <div>
              <strong>{t('financeOpsBuffer')}</strong>
              <p>{t('financeOpsBufferRuleHintEmpty')}</p>
            </div>
            <span className="finance-status-mini">{t('financeTarget')}</span>
          </div>
          <div className="finance-switch-row">
            <div>
              <strong>{t('financeAutoCategorize')}</strong>
              <p>{t('financeAutoCategorizeHint')}</p>
            </div>
            <Tag>{t('financePlanned')}</Tag>
          </div>
          <div className="finance-switch-row">
            <div>
              <strong>{t('financeMultiModel')}</strong>
              <p>{t('financeMultiModelHint')}</p>
            </div>
            <Tag tone="green">{t('financeUniversal')}</Tag>
          </div>
        </div>
      </div>

      <div className="finance-infobox">
        <Lightning size={17} aria-hidden />
        <div>
          <strong>{t('financeTrustPrinciple')}:</strong> {t('financeTrustBody')}
        </div>
      </div>
    </div>
  )
}

