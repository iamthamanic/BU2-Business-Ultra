/**
 * CustomerJourneyGrid — Legacy-style phases × lanes matrix with group pills
 * and cell preset picker. Location: apps/web/src/components/product/CustomerJourneyGrid.tsx
 */
import {
  ChartBar,
  Eye,
  GearSix,
  HandPointing,
  Heart,
  Lightbulb,
  MagnifyingGlass,
  Plus,
  Question,
  Smiley,
  Truck,
  User,
  Broadcast,
  Check,
  X,
} from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import {
  LANE_GROUPS,
  LANE_META,
  LIFECYCLE_META,
  getCellLabels,
  normalizeJourneyMap,
  presetsForLane,
  setCellLabels,
  type JourneyLaneGroup,
  type JourneyLaneKey,
  type JourneyMap,
  type JourneyPhase,
} from '../../features/product/customerJourney'
import { initials } from '../../features/product/productTypes'

type Props = {
  value: JourneyMap | undefined
  onChange: (map: JourneyMap) => void
  readOnly?: boolean
  productName?: string
  productCover?: string | null
}

const PHASE_ICONS: Record<string, typeof Eye> = {
  awareness: Eye,
  consideration: MagnifyingGlass,
  conversion: Check,
  delivery: Truck,
  advocacy: Heart,
}

const LANE_ICONS: Record<JourneyLaneKey, typeof HandPointing> = {
  actions: HandPointing,
  touchpoints: Broadcast,
  emotions: Smiley,
  metrics: ChartBar,
  owners: User,
  blueprint: GearSix,
  insights: Lightbulb,
}

export function CustomerJourneyGrid({
  value,
  onChange,
  readOnly,
  productName,
  productCover,
}: Props) {
  const { t } = useI18n()
  const map = useMemo(() => normalizeJourneyMap(value), [value])
  const [hidden, setHidden] = useState<Record<JourneyLaneGroup, boolean>>({
    Kunde: false,
    Messung: false,
    Organisation: false,
    Optimierung: false,
  })
  const [panel, setPanel] = useState<{ phaseId: string; lane: JourneyLaneKey } | null>(null)
  const [custom, setCustom] = useState('')

  const visibleLanes = LANE_META.filter((l) => !hidden[l.group])
  const activePhase: JourneyPhase | undefined = panel
    ? map.phases.find((p) => p.id === panel.phaseId)
    : undefined
  const activeLabels = panel ? getCellLabels(map, panel.phaseId, panel.lane) : []
  const activePresets = panel && activePhase
    ? presetsForLane(panel.lane, activePhase.lifecycle, activeLabels)
    : []

  function toggleGroup(g: JourneyLaneGroup) {
    setHidden((h) => ({ ...h, [g]: !h[g] }))
  }

  function openCell(phaseId: string, lane: JourneyLaneKey) {
    if (readOnly) return
    setPanel({ phaseId, lane })
    setCustom('')
  }

  function patchLabels(next: string[]) {
    if (!panel) return
    onChange(setCellLabels(map, panel.phaseId, panel.lane, next))
  }

  function toggleLabel(label: string) {
    if (activeLabels.includes(label)) {
      patchLabels(activeLabels.filter((x) => x !== label))
    } else {
      patchLabels([...activeLabels, label])
    }
  }

  function addCustom() {
    const v = custom.trim()
    if (!v) return
    if (!activeLabels.includes(v)) patchLabels([...activeLabels, v])
    setCustom('')
  }

  return (
    <div className="cj-map">
      <div className="cj-map-bar">
        <div className="cj-map-title">
          <strong>{t('productSubJourney')}</strong>
          <span className="cj-map-prod" title={productName?.trim() || t('productJourneyNoProduct')}>
            {productCover ? (
              <img className="cj-map-prod-thumb" src={productCover} alt="" />
            ) : (
              <span className="cj-map-prod-av" aria-hidden>
                {initials(productName || t('product'))}
              </span>
            )}
            <span className="muted cj-map-prod-name">
              {productName?.trim() || t('productJourneyNoProduct')}
            </span>
          </span>
        </div>
        <div className="cj-lane-toggles" role="group" aria-label={t('productJourneyViews')}>
          {LANE_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              className={`cj-chip${!hidden[g] ? ' is-on' : ''}`}
              aria-pressed={!hidden[g]}
              onClick={() => toggleGroup(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="cj-grid-wrap">
        <table className="cj-grid">
          <thead>
            <tr>
              <th className="cj-corner">
                <span className="label">{t('productJourneyLane')}</span>
              </th>
              {map.phases.map((ph) => {
                const Icon = PHASE_ICONS[ph.lifecycle] || Eye
                const life = LIFECYCLE_META[ph.lifecycle]
                return (
                  <th key={ph.id}>
                    <div className="cj-ph-head">
                      <Icon size={16} weight="regular" className="cj-ph-ic" aria-hidden />
                      <div className="cj-ph-text">
                        <div className="cj-ph-title">{ph.title}</div>
                        <div className="cj-ph-life">{life.label}</div>
                      </div>
                      <span className="cj-tip" title={life.tip} aria-label={life.tip}>
                        <Question size={12} weight="bold" aria-hidden />
                      </span>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visibleLanes.map((lane) => {
              const LaneIcon = LANE_ICONS[lane.key]
              return (
                <tr key={lane.key}>
                  <th>
                    <div className="cj-lane-head">
                      <LaneIcon size={16} weight="regular" aria-hidden />
                      <span className="cj-lane-lab">{lane.label}</span>
                      <span className="cj-tip" title={lane.tip} aria-label={lane.tip}>
                        <Question size={12} weight="bold" aria-hidden />
                      </span>
                    </div>
                  </th>
                  {map.phases.map((ph) => {
                    const labels = getCellLabels(map, ph.id, lane.key)
                    const isOpen = panel?.phaseId === ph.id && panel.lane === lane.key
                    return (
                      <td key={`${ph.id}-${lane.key}`}>
                        <button
                          type="button"
                          className={`cj-cell cj-cell-${lane.key}${isOpen ? ' is-on' : ''}`}
                          disabled={readOnly}
                          onClick={() => openCell(ph.id, lane.key)}
                        >
                          {labels.length === 0 ? (
                            <span className="cj-cell-empty">
                              <span className="cj-cell-add" aria-hidden>
                                +
                              </span>
                              <span className="cj-cell-empty-lab">{t('productJourneyAdd')}</span>
                            </span>
                          ) : (
                            <span className="cj-cell-chips">
                              {labels.map((lab) => (
                                <span key={lab} className="cj-chip-item">
                                  <span className="cj-chip-lab">{lab}</span>
                                </span>
                              ))}
                            </span>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {panel && activePhase ? (
        <div className="cj-panel" role="dialog" aria-label={t('productJourneyEditCell')}>
          <div className="cj-panel-head">
            <div>
              <p className="label">
                {activePhase.title} · {LANE_META.find((l) => l.key === panel.lane)?.label}
              </p>
              <strong>{LIFECYCLE_META[activePhase.lifecycle].label}</strong>
            </div>
            <button
              type="button"
              className="btn icon-btn"
              aria-label={t('closeMenu')}
              onClick={() => setPanel(null)}
            >
              <X size={14} weight="bold" aria-hidden />
            </button>
          </div>

          <div className="cj-pick">
            {activePresets.map((p) => {
              const on = activeLabels.includes(p.label)
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`cj-pick-chip${on ? ' is-on' : ''}`}
                  onClick={() => toggleLabel(p.label)}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          <div className="cj-custom">
            <input
              className="input"
              value={custom}
              placeholder={t('productJourneyCustomPh')}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustom()
                }
              }}
            />
            <button type="button" className="btn" onClick={addCustom}>
              <Plus size={12} weight="bold" aria-hidden />
              {t('productJourneyAdd')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
