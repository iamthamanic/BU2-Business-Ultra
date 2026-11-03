/**
 * CreatePostPresets — Global + per-platform accordion presets (UI-only).
 * Location: apps/web/src/components/create-post/CreatePostPresets.tsx
 */
import { useState, type ReactNode } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import { MKT_ORGANIC_ICONS } from '../mktTabIcons'
import { useI18n } from '../../lib/i18n'
import type { MessageKey } from '../../i18n/messages'
import { isCorePlatform } from './formats'
import type { CorePlatformId, GlobalPresets, PlatformId, PlatformPresetState } from './types'

const PRESET_TITLE: Record<CorePlatformId, MessageKey> = {
  facebook: 'createPostPreset_facebook',
  instagram: 'createPostPreset_instagram',
  linkedin: 'createPostPreset_linkedin',
  tiktok: 'createPostPreset_tiktok',
  youtube: 'createPostPreset_youtube',
}

type Props = {
  selected: PlatformId[]
  global: GlobalPresets
  platform: PlatformPresetState
  onGlobal: (patch: Partial<GlobalPresets>) => void
  onPlatform: (patch: Partial<PlatformPresetState>) => void
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <div className="create-post-switch-row">
      <span className="muted">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`create-post-switch${checked ? ' is-on' : ''}`}
        onClick={onChange}
      >
        <span className="create-post-switch-knob" aria-hidden />
      </button>
    </div>
  )
}

function Accordion({
  id,
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  id: string
  title: string
  icon?: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="create-post-acc panel" data-acc={id}>
      <button
        type="button"
        className="create-post-acc-head"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="create-post-acc-title">
          {icon}
          {title}
        </span>
        <CaretDown
          size={12}
          weight="bold"
          className={`create-post-acc-caret${open ? ' is-open' : ''}`}
          aria-hidden
        />
      </button>
      {open ? <div className="create-post-acc-body">{children}</div> : null}
    </div>
  )
}

export function CreatePostPresets({
  selected,
  global,
  platform,
  onGlobal,
  onPlatform,
}: Props) {
  const { t } = useI18n()
  const [openId, setOpenId] = useState<string>('global')

  function toggle(id: string) {
    setOpenId((v) => (v === id ? '' : id))
  }

  const cores = selected.filter((id): id is CorePlatformId => isCorePlatform(id))

  return (
    <div className="create-post-preset-stack">
      <Accordion
        id="global"
        title={t('createPostGlobals')}
        open={openId === 'global'}
        onToggle={() => toggle('global')}
      >
        <SwitchRow
          label={t('createPostAutoPublish')}
          checked={global.autoPublish}
          onChange={() => onGlobal({ autoPublish: !global.autoPublish })}
        />
        <SwitchRow
          label={t('createPostUrlShort')}
          checked={global.urlShortener}
          onChange={() => onGlobal({ urlShortener: !global.urlShortener })}
        />
        <SwitchRow
          label={t('createPostSmartLinks')}
          checked={global.smartLinks}
          onChange={() => onGlobal({ smartLinks: !global.smartLinks })}
        />
        <label className="create-post-field">
          <span className="label">{t('createPostCampaignDash')}</span>
          <select
            className="input"
            value={global.campaignDashboard}
            onChange={(e) => onGlobal({ campaignDashboard: e.target.value })}
          >
            <option value="">{t('createPostCampaignDashPh')}</option>
            <option value="main">Main</option>
            <option value="brand">Brand</option>
          </select>
        </label>
        <SwitchRow
          label={t('createPostAiContent')}
          checked={platform.aiGenerated}
          onChange={() => onPlatform({ aiGenerated: !platform.aiGenerated })}
        />
        <SwitchRow
          label={t('createPostCommercial')}
          checked={platform.commercial}
          onChange={() => onPlatform({ commercial: !platform.commercial })}
        />
      </Accordion>

      {cores.map((id) => {
        const Glyph = MKT_ORGANIC_ICONS[id]
        const title = t(PRESET_TITLE[id])
        return (
          <Accordion
            key={id}
            id={id}
            title={title}
            icon={
              <span className="create-post-plat-ic" data-ic={id} aria-hidden>
                <Glyph size={14} weight="regular" />
              </span>
            }
            open={openId === id}
            onToggle={() => toggle(id)}
          >
            {id === 'facebook' ? (
              <label className="create-post-field">
                <span className="label">{t('createPostFbTitle')}</span>
                <input
                  className="input"
                  value={platform.fbTitle}
                  onChange={(e) => onPlatform({ fbTitle: e.target.value })}
                />
              </label>
            ) : null}

            {id === 'instagram' ? (
              <>
                <button type="button" className="btn create-post-dashed" disabled>
                  {t('createPostIgCollab')}
                </button>
                <button type="button" className="btn create-post-dashed" disabled>
                  {t('createPostIgAudio')}
                </button>
                <SwitchRow
                  label={t('createPostIgFeed')}
                  checked={platform.igShowInFeed}
                  onChange={() => onPlatform({ igShowInFeed: !platform.igShowInFeed })}
                />
                <SwitchRow
                  label={t('createPostIgPromote')}
                  checked={platform.igPromote}
                  onChange={() => onPlatform({ igPromote: !platform.igPromote })}
                />
                <SwitchRow
                  label={t('createPostAiContent')}
                  checked={platform.igAiContent}
                  onChange={() => onPlatform({ igAiContent: !platform.igAiContent })}
                />
              </>
            ) : null}

            {id === 'linkedin' ? (
              <>
                <SwitchRow
                  label={t('createPostLiPreview')}
                  checked={platform.liLinkPreview}
                  onChange={() => onPlatform({ liLinkPreview: !platform.liLinkPreview })}
                />
                <SwitchRow
                  label={t('createPostLiCarousel')}
                  checked={platform.liCarousel}
                  onChange={() => onPlatform({ liCarousel: !platform.liCarousel })}
                />
              </>
            ) : null}

            {id === 'tiktok' || id === 'youtube' ? (
              <>
                <label className="create-post-field">
                  <span className="label">{t('createPostYtTitle')}</span>
                  <input
                    className="input"
                    value={platform.ytTitle}
                    maxLength={100}
                    onChange={(e) => onPlatform({ ytTitle: e.target.value })}
                  />
                  <span className="muted kpi create-post-field-hint">
                    {platform.ytTitle.length}/100
                  </span>
                </label>
                <label className="create-post-field">
                  <span className="label">{t('createPostYtAudience')}</span>
                  <select
                    className="input"
                    value={platform.ytAudienceKids ? 'kids' : 'no'}
                    onChange={(e) => onPlatform({ ytAudienceKids: e.target.value === 'kids' })}
                  >
                    <option value="no">{t('createPostYtAudienceNo')}</option>
                    <option value="kids">{t('createPostYtAudienceYes')}</option>
                  </select>
                </label>
                <label className="create-post-field">
                  <span className="label">{t('createPostYtPrivacy')}</span>
                  <select
                    className="input"
                    value={platform.ytPrivacy}
                    onChange={(e) =>
                      onPlatform({
                        ytPrivacy: e.target.value as PlatformPresetState['ytPrivacy'],
                      })
                    }
                  >
                    <option value="public">{t('createPostYtPublic')}</option>
                    <option value="unlisted">{t('createPostYtUnlisted')}</option>
                    <option value="private">{t('createPostYtPrivate')}</option>
                  </select>
                </label>
                <label className="create-post-field">
                  <span className="label">{t('createPostYtPlaylist')}</span>
                  <input
                    className="input"
                    value={platform.ytPlaylist}
                    onChange={(e) => onPlatform({ ytPlaylist: e.target.value })}
                  />
                </label>
                <label className="create-post-field">
                  <span className="label">{t('createPostYtTags')}</span>
                  <input
                    className="input"
                    value={platform.ytTags}
                    onChange={(e) => onPlatform({ ytTags: e.target.value })}
                  />
                </label>
                <SwitchRow
                  label={t('createPostYtNotify')}
                  checked={platform.ytNotify}
                  onChange={() => onPlatform({ ytNotify: !platform.ytNotify })}
                />
              </>
            ) : null}
          </Accordion>
        )
      })}
    </div>
  )
}
