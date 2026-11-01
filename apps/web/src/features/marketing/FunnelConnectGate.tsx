/**
 * FunnelConnectGate — premium empty/connect surface when Metricool/Brevo (or Ads) is missing.
 * Primary CTA deep-links to Settings → Verbindungen. Location: apps/web/src/features/marketing/FunnelConnectGate.tsx
 */
import { Link } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'

export type ConnectNeed = 'key' | 'brand' | 'stub'

type Props = {
  providerLabel: string
  need: ConnectNeed
  settingsHref: string
  channelLabel?: string
  hint?: string
}

export function FunnelConnectGate({
  providerLabel,
  need,
  settingsHref,
  channelLabel,
  hint,
}: Props) {
  const { t } = useI18n()
  const title =
    need === 'key'
      ? t('connectGateKeyTitle')
      : need === 'brand'
        ? t('connectGateBrandTitle')
        : t('connectGateStubTitle')
  const body =
    need === 'key'
      ? t('connectGateKeyBody').replace('{provider}', providerLabel)
      : need === 'brand'
        ? t('connectGateBrandBody').replace('{provider}', providerLabel)
        : hint || t('connectGateStubBody')

  return (
    <div className="funnel-connect-gate state-block empty-state" role="status">
      <p className="funnel-connect-eyebrow muted">
        {channelLabel ? `${channelLabel} · ${providerLabel}` : providerLabel}
      </p>
      <h2 className="funnel-connect-title">{title}</h2>
      <p className="funnel-connect-body muted">{body}</p>
      {need !== 'stub' ? (
        <Link className="btn primary" to={settingsHref}>
          {need === 'key' ? t('connectGateCtaKey') : t('connectGateCtaBrand')}
        </Link>
      ) : null}
    </div>
  )
}
