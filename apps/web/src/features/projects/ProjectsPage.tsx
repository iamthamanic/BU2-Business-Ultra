/**
 * ProjectsPage — Dark-Ops shell stub for `/co/:slug/projects`.
 * Title + lede only; module content lands later. Location: apps/web/src/features/projects/ProjectsPage.tsx
 */
import { useI18n } from '../../lib/i18n'

export function ProjectsPage() {
  const { t } = useI18n()
  return (
    <div className="stack">
      <header className="funnel-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            {t('projects')}
          </h1>
          <p className="muted page-lede">{t('projectsLede')}</p>
        </div>
      </header>
    </div>
  )
}
