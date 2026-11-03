/**
 * create-post/types — Local UI state shapes for CreatePostModal (no API).
 * Location: apps/web/src/components/create-post/types.ts
 */

export type CorePlatformId = 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube'

export type ExtraNetworkId = 'x' | 'threads' | 'bluesky' | 'gbp' | 'pinterest'

export type PlatformId = CorePlatformId | ExtraNetworkId

export type PostFormat = 'post' | 'reel' | 'story' | 'short' | 'poll' | 'trial_reel'

export type GlobalPresets = {
  autoPublish: boolean
  urlShortener: boolean
  smartLinks: boolean
  campaignDashboard: string
}

export type PlatformPresetState = {
  fbTitle: string
  igShowInFeed: boolean
  igPromote: boolean
  igAiContent: boolean
  liLinkPreview: boolean
  liCarousel: boolean
  ytTitle: string
  ytAudienceKids: boolean
  ytPrivacy: 'public' | 'unlisted' | 'private'
  ytPlaylist: string
  ytTags: string
  ytNotify: boolean
  ytAiContent: boolean
  commercial: boolean
  aiGenerated: boolean
}

export function emptyTexts(): Record<PlatformId, string> {
  return {
    facebook: '',
    instagram: '',
    linkedin: '',
    tiktok: '',
    youtube: '',
    x: '',
    threads: '',
    bluesky: '',
    gbp: '',
    pinterest: '',
  }
}

export function defaultFormats(): Record<CorePlatformId, PostFormat> {
  return {
    facebook: 'post',
    instagram: 'post',
    linkedin: 'post',
    tiktok: 'post',
    youtube: 'short',
  }
}

export function defaultPlatformPresets(): PlatformPresetState {
  return {
    fbTitle: '',
    igShowInFeed: true,
    igPromote: false,
    igAiContent: false,
    liLinkPreview: true,
    liCarousel: false,
    ytTitle: '',
    ytAudienceKids: false,
    ytPrivacy: 'public',
    ytPlaylist: '',
    ytTags: '',
    ytNotify: true,
    ytAiContent: false,
    commercial: false,
    aiGenerated: false,
  }
}

export function defaultGlobalPresets(): GlobalPresets {
  return {
    autoPublish: false,
    urlShortener: false,
    smartLinks: false,
    campaignDashboard: '',
  }
}
