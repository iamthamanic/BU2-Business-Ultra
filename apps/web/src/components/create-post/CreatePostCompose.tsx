/**
 * CreatePostCompose — Caption textarea + toolbar shell + per-platform edit toggle.
 * Location: apps/web/src/components/create-post/CreatePostCompose.tsx
 */
import type { RefObject } from 'react'
import type { Icon } from '@phosphor-icons/react'
import {
  At,
  Hash,
  ImageSquare,
  LinkSimple,
  MapPin,
  Paperclip,
  PencilSimple,
  Smiley,
} from '@phosphor-icons/react'
import { useI18n } from '../../lib/i18n'

const CHAR_LIMIT = 2000
const HASH_LIMIT = 30
const ICON = 14

const TOOLS: { Icon: Icon; key: string }[] = [
  { Icon: ImageSquare, key: 'media' },
  { Icon: Paperclip, key: 'file' },
  { Icon: Smiley, key: 'emoji' },
  { Icon: Hash, key: 'hash' },
  { Icon: At, key: 'mention' },
  { Icon: MapPin, key: 'place' },
  { Icon: LinkSimple, key: 'link' },
]

type Props = {
  text: string
  editPerPlatform: boolean
  activePlatformLabel: string
  textRef: RefObject<HTMLTextAreaElement | null>
  onChangeText: (v: string) => void
  onTogglePerPlatform: () => void
}

export function CreatePostCompose({
  text,
  editPerPlatform,
  activePlatformLabel,
  textRef,
  onChangeText,
  onTogglePerPlatform,
}: Props) {
  const { t } = useI18n()
  const hashes = (text.match(/#\w+/g) || []).length

  return (
    <div className="create-post-compose-block">
      <button
        type="button"
        className={`btn create-post-per-platform${editPerPlatform ? ' is-on' : ''}`}
        aria-pressed={editPerPlatform}
        onClick={onTogglePerPlatform}
      >
        <PencilSimple size={ICON} weight="regular" aria-hidden />
        {t('createPostPerPlatform')}
      </button>
      {editPerPlatform ? (
        <p className="muted create-post-per-hint">
          {t('createPostPerHint').replace('{ch}', activePlatformLabel)}
        </p>
      ) : null}

      <div className="create-post-compose">
        <textarea
          ref={textRef}
          className="textarea create-post-textarea"
          value={text}
          onChange={(e) => onChangeText(e.target.value.slice(0, CHAR_LIMIT))}
          placeholder={t('createPostTextPh')}
          rows={7}
        />
        <div className="create-post-compose-bar">
          <div className="create-post-tools" aria-hidden>
            {TOOLS.map(({ Icon: Tool, key }) => (
              <span key={key} className="create-post-tool">
                <Tool size={ICON} weight="regular" />
              </span>
            ))}
          </div>
          <span className="muted create-post-count kpi">
            {hashes}/{HASH_LIMIT}# · {text.length}/{CHAR_LIMIT}
          </span>
        </div>
      </div>
    </div>
  )
}
