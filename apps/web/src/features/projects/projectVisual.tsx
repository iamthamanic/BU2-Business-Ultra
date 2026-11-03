/**
 * Project visual helpers — area glyphs shared by list cards and pickers.
 * Location: apps/web/src/features/projects/projectVisual.tsx
 */
import type { Icon } from '@phosphor-icons/react'
import { Cube, Folders, Megaphone, UsersThree } from '@phosphor-icons/react'
import type { BuProject } from './projectTypes'

export function projectGlyph(p: Pick<BuProject, 'area' | 'name'>): {
  Icon: Icon
  dataIc: string
} {
  const key = `${p.area || ''} ${p.name}`.toLowerCase()
  if (key.includes('marketing')) return { Icon: Megaphone, dataIc: 'marketing' }
  if (key.includes('kunden') || key.includes('customer')) return { Icon: UsersThree, dataIc: 'customer' }
  if (key.includes('produkt') || key.includes('product')) return { Icon: Cube, dataIc: 'product' }
  return { Icon: Folders, dataIc: 'projects' }
}

export function ProjectGlyphAvatar({
  project,
  size = 16,
  className = 'product-card-av project-av',
}: {
  project: Pick<BuProject, 'area' | 'name'>
  size?: number
  className?: string
}) {
  const { Icon, dataIc } = projectGlyph(project)
  return (
    <span className={className} data-ic={dataIc} aria-hidden>
      <Icon size={size} weight="regular" />
    </span>
  )
}
