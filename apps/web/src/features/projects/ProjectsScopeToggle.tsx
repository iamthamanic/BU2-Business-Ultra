/**
 * ProjectsScopeToggle — segmented switch: Alle Projekte | Meine Aufgaben | Wiederkehrend.
 * Location: apps/web/src/features/projects/ProjectsScopeToggle.tsx
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowsClockwise, ListChecks, SquaresFour } from '@phosphor-icons/react'
import { useI18n } from '../../lib/i18n'
import { companyRoutes } from '../../lib/companyPaths'

export type ProjectsScope = 'all' | 'mine' | 'recurring'

type Props = {
  slug: string
  active: ProjectsScope
}

export function ProjectsScopeToggle({ slug, active }: Props) {
  const { t } = useI18n()
  const routes = companyRoutes(slug)

  const items: Array<{
    id: ProjectsScope
    to: string
    label: string
    icon: ReactNode
  }> = [
    {
      id: 'all',
      to: routes.projects,
      label: t('projectsAll'),
      icon: <SquaresFour size={14} weight="regular" aria-hidden />,
    },
    {
      id: 'mine',
      to: routes.projectsMine,
      label: t('projectsMine'),
      icon: <ListChecks size={14} weight="bold" aria-hidden />,
    },
    {
      id: 'recurring',
      to: routes.projectsRecurring,
      label: t('projectsRecurring'),
      icon: <ArrowsClockwise size={14} weight="bold" aria-hidden />,
    },
  ]

  return (
    <div
      className="product-archive-toggle project-scope-toggle"
      role="tablist"
      aria-label={t('projects')}
    >
      {items.map((item) => {
        const on = active === item.id
        return (
          <Link
            key={item.id}
            role="tab"
            aria-selected={on}
            to={item.to}
            className={`archive-seg project-scope-seg${on ? ' is-on' : ''}`}
          >
            {item.icon}
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
