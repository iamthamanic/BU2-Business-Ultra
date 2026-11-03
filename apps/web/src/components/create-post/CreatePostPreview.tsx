/**
 * CreatePostPreview — Feed card or vertical reel/short mock by format.
 * Location: apps/web/src/components/create-post/CreatePostPreview.tsx
 */
import {
  ChatCircle,
  DeviceMobile,
  DotsThree,
  Heart,
  ImageSquare,
  Monitor,
  PaperPlaneTilt,
  ShareNetwork,
} from '@phosphor-icons/react'
import { MKT_ORGANIC_ICONS } from '../mktTabIcons'
import { useI18n } from '../../lib/i18n'
import type { MessageKey } from '../../i18n/messages'
import { getFormatFor, isCorePlatform, isVerticalFormat } from './formats'
import type { CorePlatformId, PlatformId, PostFormat } from './types'

const ICON = 14

type Props = {
  brandLabel: string
  brandInit: string
  selected: PlatformId[]
  previewPlatform: PlatformId
  formats: Record<CorePlatformId, PostFormat>
  text: string
  previewDevice: 'mobile' | 'desktop'
  onPreviewPlatform: (id: PlatformId) => void
  onDevice: (d: 'mobile' | 'desktop') => void
}

function platformTitle(
  id: PlatformId,
  t: (k: MessageKey) => string,
): string {
  if (isCorePlatform(id)) return t(`ch_${id}`)
  const map: Record<string, MessageKey> = {
    x: 'createPostNetX',
    threads: 'createPostNetThreads',
    bluesky: 'createPostNetBluesky',
    gbp: 'createPostNetGbp',
    pinterest: 'createPostNetPinterest',
  }
  return t(map[id] || 'createPostNetX')
}

export function CreatePostPreview({
  brandLabel,
  brandInit,
  selected,
  previewPlatform,
  formats,
  text,
  previewDevice,
  onPreviewPlatform,
  onDevice,
}: Props) {
  const { t } = useI18n()
  const fmt = getFormatFor(previewPlatform, formats)
  const vertical = isVerticalFormat(fmt)
  const PreviewIcon = isCorePlatform(previewPlatform)
    ? MKT_ORGANIC_ICONS[previewPlatform]
    : null

  return (
    <aside className="create-post-preview" aria-label={t('createPostPreview')}>
      <div className="create-post-preview-top">
        <div className="mkt-tabs mkt-tabs--surface create-post-preview-tabs" role="tablist">
          {selected.map((id) => {
            const Glyph = isCorePlatform(id) ? MKT_ORGANIC_ICONS[id] : null
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={previewPlatform === id}
                className={`mkt-tab${previewPlatform === id ? ' is-active' : ''}`}
                data-ic={isCorePlatform(id) ? id : undefined}
                onClick={() => onPreviewPlatform(id)}
              >
                {Glyph ? (
                  <span className="mkt-tab-ic" aria-hidden>
                    <Glyph size={ICON} weight="regular" />
                  </span>
                ) : null}
                <span className="mkt-tab-label">{platformTitle(id, t)}</span>
              </button>
            )
          })}
        </div>
        <div className="create-post-device" role="group" aria-label={t('createPostDevice')}>
          <button
            type="button"
            className={`btn icon-btn${previewDevice === 'mobile' ? ' is-active' : ''}`}
            aria-pressed={previewDevice === 'mobile'}
            onClick={() => onDevice('mobile')}
          >
            <DeviceMobile size={ICON} weight="regular" aria-hidden />
          </button>
          <button
            type="button"
            className={`btn icon-btn${previewDevice === 'desktop' ? ' is-active' : ''}`}
            aria-pressed={previewDevice === 'desktop'}
            onClick={() => onDevice('desktop')}
          >
            <Monitor size={ICON} weight="regular" aria-hidden />
          </button>
        </div>
      </div>

      <div
        className={`create-post-mock${previewDevice === 'desktop' ? ' is-desktop' : ''}${
          vertical ? ' is-vertical' : ''
        }`}
      >
        {vertical ? (
          <div className="create-post-reel panel">
            <div className="create-post-reel-stage">
              <span className="muted">{t('createPostVideoMissing')}</span>
              <div className="create-post-reel-side" aria-hidden>
                <Heart size={18} weight="regular" />
                <ChatCircle size={18} weight="regular" />
                <ShareNetwork size={18} weight="regular" />
                <DotsThree size={18} weight="bold" />
              </div>
              <div className="create-post-reel-meta">
                <span className="create-post-mock-av">{brandInit}</span>
                <div>
                  <strong>{brandLabel}</strong>
                  <p className="muted create-post-mock-text-sm">
                    {text.trim() || t('createPostPreviewEmpty')}
                  </p>
                  <p className="muted create-post-mock-meta">Original Audio</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="panel create-post-mock-card">
            <div className="create-post-mock-head">
              <span className="create-post-mock-av" aria-hidden>
                {brandInit}
              </span>
              <div>
                <strong className="create-post-mock-name">{brandLabel}</strong>
                <p className="muted create-post-mock-meta">
                  {PreviewIcon ? (
                    <span
                      className="create-post-mock-plat-ic"
                      data-ic={isCorePlatform(previewPlatform) ? previewPlatform : undefined}
                      aria-hidden
                    >
                      <PreviewIcon size={12} weight="regular" />
                    </span>
                  ) : null}
                  {platformTitle(previewPlatform, t)} · {t('dateToday')}
                </p>
              </div>
            </div>
            <p className="create-post-mock-text">
              {text.trim() ? text : <span className="muted">{t('createPostPreviewEmpty')}</span>}
            </p>
            <div className="create-post-mock-media muted" aria-hidden>
              <ImageSquare size={24} weight="regular" />
            </div>
            <div className="create-post-mock-actions muted" aria-hidden>
              <Heart size={14} />
              <ChatCircle size={14} />
              <PaperPlaneTilt size={14} />
            </div>
          </div>
        )}
        <p className="muted create-post-preview-note">{t('createPostPreviewNote')}</p>
      </div>
    </aside>
  )
}
