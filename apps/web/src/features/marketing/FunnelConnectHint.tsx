/**
 * FunnelConnectHint — soft Legacy-style dashed banner above funnel tables.
 * Never replaces the main surface; links to Settings → Verbindungen.
 * Location: apps/web/src/features/marketing/FunnelConnectHint.tsx
 */
import { Link } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'

export type ConnectNeed = 'key' | 'brand' | 'stub'

type Props = {
  need: ConnectNeed
  settingsHref: string
  /** Optional override body (e.g. offline/ads stub copy). */
  message?: string
}

export function FunnelConnectHint({ need, settingsHref, message }: Props) {
  const { t } = useI18n()
  const text =
    message ||
    (need === 'key'
      ? t('connectBannerKey')
      : need === 'brand'
        ? t('connectBannerBrand')
        : t('connectBannerStub'))

  return (
    <div className="funnel-connect-hint" role="status">
      <span className="funnel-connect-hint-text">{text}</span>
      {need !== 'stub' ? (
        <Link className="funnel-connect-hint-link" to={settingsHref}>
          {t('connectBannerCta')}
        </Link>
      ) : null}
    </div>
  )
}
