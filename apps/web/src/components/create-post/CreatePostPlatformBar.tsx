/**
 * CreatePostPlatformBar — Selected platforms + format dropdown + add-network menu.
 * Location: apps/web/src/components/create-post/CreatePostPlatformBar.tsx
 */
import { useEffect, useRef, useState } from 'react'
import { CaretDown, Note, Plus } from '@phosphor-icons/react'
import { MKT_ORGANIC_ICONS } from '../mktTabIcons'
import { useI18n } from '../../lib/i18n'
import type { MessageKey } from '../../i18n/messages'
import {
  CORE_PLATFORMS,
  EXTRA_NETWORKS,
  FORMATS_BY_PLATFORM,
  formatLabelKey,
  isCorePlatform,
} from './formats'
import type { CorePlatformId, ExtraNetworkId, PlatformId, PostFormat } from './types'

const ICON = 14

type Props = {
  selected: PlatformId[]
  formats: Record<CorePlatformId, PostFormat>
  notesOpen: boolean
  onTogglePlatform: (id: PlatformId) => void
  onSetFormat: (id: CorePlatformId, fmt: PostFormat) => void
  onToggleNotes: () => void
}

function extraLabel(
  id: ExtraNetworkId,
  t: (k: MessageKey) => string,
): string {
  const map: Record<ExtraNetworkId, MessageKey> = {
    x: 'createPostNetX',
    threads: 'createPostNetThreads',
    bluesky: 'createPostNetBluesky',
    gbp: 'createPostNetGbp',
    pinterest: 'createPostNetPinterest',
  }
  return t(map[id])
}

export function CreatePostPlatformBar({
  selected,
  formats,
  notesOpen,
  onTogglePlatform,
  onSetFormat,
  onToggleNotes,
}: Props) {
  const { t } = useI18n()
  const [openFmt, setOpenFmt] = useState<CorePlatformId | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpenFmt(null)
        setAddOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const coreSelected = selected.filter((id): id is CorePlatformId => isCorePlatform(id))
  const extraSelected = selected.filter((id): id is ExtraNetworkId =>
    (EXTRA_NETWORKS as string[]).includes(id),
  )

  return (
    <div className="create-post-platbar" ref={rootRef}>
      <div className="create-post-platforms" role="group" aria-label={t('createPostPlatforms')}>
        {coreSelected.map((id) => {
          const Glyph = MKT_ORGANIC_ICONS[id]
          const fmt = formats[id]
          const opts = FORMATS_BY_PLATFORM[id]
          return (
            <div key={id} className="create-post-plat-wrap">
              <button
                type="button"
                className="chip create-post-plat active"
                data-ic={id}
                onClick={() => onTogglePlatform(id)}
                title={t(`ch_${id}` as 'ch_instagram')}
              >
                <span className="create-post-plat-ic" aria-hidden>
                  <Glyph size={ICON} weight="regular" />
                </span>
              </button>
              {opts.length > 1 ? (
                <div className="create-post-fmt">
                  <button
                    type="button"
                    className="create-post-fmt-btn"
                    aria-expanded={openFmt === id}
                    onClick={() => setOpenFmt((v) => (v === id ? null : id))}
                  >
                    {t(formatLabelKey(fmt))}
                    <CaretDown size={10} weight="bold" aria-hidden />
                  </button>
                  {openFmt === id ? (
                    <div className="create-post-fmt-menu panel" role="listbox">
                      {opts.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          role="option"
                          aria-selected={fmt === opt}
                          className={`create-post-fmt-opt${fmt === opt ? ' is-active' : ''}`}
                          onClick={() => {
                            onSetFormat(id, opt)
                            setOpenFmt(null)
                          }}
                        >
                          {t(formatLabelKey(opt))}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}

        {extraSelected.map((id) => (
          <button
            key={id}
            type="button"
            className="chip create-post-plat active"
            onClick={() => onTogglePlatform(id)}
          >
            <span>{extraLabel(id, t)}</span>
          </button>
        ))}

        <div className="create-post-add">
          <button
            type="button"
            className="btn icon-btn"
            aria-expanded={addOpen}
            aria-label={t('createPostAddNetwork')}
            onClick={() => {
              setAddOpen((v) => !v)
              setOpenFmt(null)
            }}
          >
            <Plus size={ICON} weight="bold" aria-hidden />
          </button>
          {addOpen ? (
            <div className="create-post-add-menu panel" role="menu">
              {CORE_PLATFORMS.filter((id) => !selected.includes(id)).map((id) => {
                const Glyph = MKT_ORGANIC_ICONS[id]
                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitem"
                    className="create-post-add-opt"
                    data-ic={id}
                    onClick={() => {
                      onTogglePlatform(id)
                      setAddOpen(false)
                    }}
                  >
                    <span className="create-post-plat-ic" aria-hidden>
                      <Glyph size={ICON} weight="regular" />
                    </span>
                    {t(`ch_${id}` as 'ch_instagram')}
                  </button>
                )
              })}
              {EXTRA_NETWORKS.filter((id) => !selected.includes(id)).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  className="create-post-add-opt"
                  onClick={() => {
                    onTogglePlatform(id)
                    setAddOpen(false)
                  }}
                >
                  {extraLabel(id, t)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className={`btn ghost create-post-notes-toggle${notesOpen ? ' is-on' : ''}`}
        aria-pressed={notesOpen}
        onClick={onToggleNotes}
      >
        <Note size={ICON} weight="regular" aria-hidden />
        {t('createPostNotes')}
      </button>
    </div>
  )
}
