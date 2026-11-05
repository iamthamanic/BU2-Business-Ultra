/**
 * FunnelConnectHint — soft warning banner for funnel empty states.
 * Renders inside the empty table row; CTA opens Settings → Verbindungen.
 * Location: apps/web/src/features/marketing/FunnelConnectHint.tsx
 */
import { WarningCircle } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'

export type ConnectNeed = 'key' | 'brand' | 'connection' | 'stub'

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
        : need === 'connection'
          ? t('connectBannerConnection')
          : t('connectBannerStub'))

  return (
    <div className="funnel-connect-hint" role="status">
      <span className="funnel-connect-hint-ic" aria-hidden>
        <WarningCircle size={18} weight="fill" />
      </span>
      <span className="funnel-connect-hint-text">{text}</span>
      {need !== 'stub' ? (
        <Link className="btn funnel-connect-hint-btn" to={settingsHref}>
          {t('connectBannerCta')}
        </Link>
      ) : null}
    </div>
  )
}
