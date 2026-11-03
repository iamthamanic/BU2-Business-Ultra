/**
 * create-post/formats — Allowed post formats per platform (Metricool-parity UI).
 * Location: apps/web/src/components/create-post/formats.ts
 */
import type { CorePlatformId, ExtraNetworkId, PlatformId, PostFormat } from './types'

export const CORE_PLATFORMS: CorePlatformId[] = [
  'facebook',
  'instagram',
  'linkedin',
  'tiktok',
  'youtube',
]

export const EXTRA_NETWORKS: ExtraNetworkId[] = [
  'x',
  'threads',
  'bluesky',
  'gbp',
  'pinterest',
]

export const FORMATS_BY_PLATFORM: Record<CorePlatformId, PostFormat[]> = {
  facebook: ['post', 'reel', 'story'],
  instagram: ['post', 'reel', 'story'],
  linkedin: ['post', 'poll'],
  tiktok: ['post', 'reel', 'story', 'trial_reel'],
  youtube: ['post', 'short'],
}

export function isVerticalFormat(fmt: PostFormat): boolean {
  return fmt === 'reel' || fmt === 'short' || fmt === 'story' || fmt === 'trial_reel'
}

export function formatLabelKey(
  fmt: PostFormat,
):
  | 'createPostFmtPost'
  | 'createPostFmtReel'
  | 'createPostFmtStory'
  | 'createPostFmtShort'
  | 'createPostFmtPoll'
  | 'createPostFmtTrialReel' {
  switch (fmt) {
    case 'post':
      return 'createPostFmtPost'
    case 'reel':
      return 'createPostFmtReel'
    case 'story':
      return 'createPostFmtStory'
    case 'short':
      return 'createPostFmtShort'
    case 'poll':
      return 'createPostFmtPoll'
    case 'trial_reel':
      return 'createPostFmtTrialReel'
    default:
      return 'createPostFmtPost'
  }
}

export function isCorePlatform(id: PlatformId): id is CorePlatformId {
  return (CORE_PLATFORMS as string[]).includes(id)
}

export function getFormatFor(
  id: PlatformId,
  formats: Record<CorePlatformId, PostFormat>,
): PostFormat {
  if (isCorePlatform(id)) return formats[id]
  return 'post'
}
