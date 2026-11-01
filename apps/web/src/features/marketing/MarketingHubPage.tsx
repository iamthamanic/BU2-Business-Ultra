/**
 * MarketingHubPage — deprecated landing; MarketingShell + nested funnel routes own the hub.
 * Kept as thin redirect for residual imports. Location: apps/web/src/features/marketing/MarketingHubPage.tsx
 */
import { Navigate, useParams } from 'react-router-dom'
import { companyRoutes, DEFAULT_ORGANIC_CHANNEL } from '../../lib/companyPaths'

export function MarketingHubPage() {
  const { slug } = useParams()
  if (!slug) return null
  return <Navigate to={companyRoutes(slug).organic(DEFAULT_ORGANIC_CHANNEL)} replace />
}
