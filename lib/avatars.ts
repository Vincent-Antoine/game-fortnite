export const AVATAR_IDS = [
  'drop',
  'storm',
  'crown',
  'wolf',
  'recon',
  'blaze',
  'ghost',
  'bolt',
  'fox',
  'tank',
  'void',
  'rose',
] as const

export type AvatarId = (typeof AVATAR_IDS)[number]

export const AVATAR_LABELS: Record<AvatarId, string> = {
  drop: 'Drop',
  storm: 'Storm',
  crown: 'Crown',
  wolf: 'Wolf',
  recon: 'Recon',
  blaze: 'Blaze',
  ghost: 'Ghost',
  bolt: 'Bolt',
  fox: 'Fox',
  tank: 'Tank',
  void: 'Void',
  rose: 'Rose',
}

export function sanitizeAvatar(value: unknown): AvatarId {
  if (typeof value === 'string' && AVATAR_IDS.includes(value as AvatarId)) {
    return value as AvatarId
  }
  return 'drop'
}
