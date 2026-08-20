import { AVATAR_IDS, AVATAR_LABELS, type AvatarId, sanitizeAvatar } from '@/lib/avatars'

type Props = {
  avatar: string
  photoData?: string | null
  size?: number
  className?: string
}

export function PlayerAvatar({ avatar, photoData, size = 40, className }: Props) {
  if (photoData) {
    return (
      <img
        src={photoData}
        alt=""
        width={size}
        height={size}
        className={`rounded-full object-cover ${className ?? ''}`}
      />
    )
  }
  const id = sanitizeAvatar(avatar)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-label={AVATAR_LABELS[id]}
    >
      <AvatarArt id={id} />
    </svg>
  )
}

function AvatarArt({ id }: { id: AvatarId }) {
  switch (id) {
    case 'drop':
      return (
        <>
          <circle cx="32" cy="32" r="32" fill="#FF7A45" />
          <path d="M12 28 C32 6 52 28 52 28 L44 38 H20 Z" fill="#F3EAD6" />
          <circle cx="32" cy="40" r="12" fill="#2A2218" />
          <circle cx="28" cy="38" r="3" fill="#F3EAD6" />
          <circle cx="38" cy="38" r="3" fill="#F3EAD6" />
        </>
      )
    case 'storm':
      return (
        <>
          <circle cx="32" cy="32" r="32" fill="#5B3DC4" />
          <path d="M18 18 H46 L42 54 H22 Z" fill="#1C1633" />
          <circle cx="32" cy="36" r="10" fill="#C084FC" />
          <path d="M24 34 Q32 42 40 34" stroke="#1C1633" strokeWidth="2" fill="none" />
        </>
      )
    case 'crown':
      return (
        <>
          <circle cx="32" cy="32" r="32" fill="#F0C14B" />
          <circle cx="32" cy="40" r="14" fill="#2A2218" />
          <path d="M16 28 L22 40 H42 L48 28 L38 34 L32 22 L26 34 Z" fill="#FF7A45" />
          <circle cx="27" cy="38" r="2.5" fill="#F3EAD6" />
          <circle cx="37" cy="38" r="2.5" fill="#F3EAD6" />
        </>
      )
    case 'wolf':
      return (
        <>
          <circle cx="32" cy="32" r="32" fill="#8B9BFF" />
          <path d="M12 22 L24 16 L32 28 L40 16 L52 22 L44 48 H20 Z" fill="#E8D5B5" />
          <circle cx="26" cy="34" r="3" fill="#1C1633" />
          <circle cx="38" cy="34" r="3" fill="#1C1633" />
          <path d="M28 42 L32 46 L36 42" fill="#FF5A7A" />
        </>
      )
    case 'recon':
      return (
        <>
          <circle cx="32" cy="32" r="32" fill="#2EC4B6" />
          <rect x="14" y="22" width="36" height="22" rx="8" fill="#1C1633" />
          <rect x="18" y="26" width="28" height="10" rx="4" fill="#7CFFF0" />
          <rect x="24" y="44" width="16" height="6" rx="2" fill="#1C1633" />
        </>
      )
    case 'blaze':
      return (
        <>
          <circle cx="32" cy="32" r="32" fill="#FF5A7A" />
          <path d="M20 40 Q18 18 32 12 Q46 18 44 40 Q32 50 20 40" fill="#FF7A45" />
          <circle cx="32" cy="38" r="10" fill="#2A2218" />
          <circle cx="28" cy="36" r="2.5" fill="#F0C14B" />
          <circle cx="36" cy="36" r="2.5" fill="#F0C14B" />
        </>
      )
    case 'ghost':
      return (
        <>
          <circle cx="32" cy="32" r="32" fill="#E8D5B5" />
          <ellipse cx="32" cy="36" rx="16" ry="18" fill="#F3EAD6" />
          <circle cx="26" cy="34" r="3" fill="#1C1633" />
          <circle cx="38" cy="34" r="3" fill="#1C1633" />
          <rect x="28" y="42" width="8" height="3" fill="#1C1633" />
        </>
      )
    case 'bolt':
      return (
        <>
          <circle cx="32" cy="32" r="32" fill="#F0C14B" />
          <path d="M34 8 L18 34 H30 L26 56 L50 28 H36 Z" fill="#1C1633" />
        </>
      )
    case 'fox':
      return (
        <>
          <circle cx="32" cy="32" r="32" fill="#F4A261" />
          <path d="M14 18 L26 28 L32 16 L38 28 L50 18 L44 50 H20 Z" fill="#FF7A45" />
          <circle cx="26" cy="36" r="3" fill="#1C1633" />
          <circle cx="38" cy="36" r="3" fill="#1C1633" />
          <circle cx="32" cy="44" r="3" fill="#2A2218" />
        </>
      )
    case 'tank':
      return (
        <>
          <circle cx="32" cy="32" r="32" fill="#6B7280" />
          <rect x="16" y="18" width="32" height="28" rx="6" fill="#1C1633" />
          <rect x="20" y="26" width="24" height="8" fill="#F0C14B" />
          <rect x="26" y="46" width="12" height="8" fill="#1C1633" />
        </>
      )
    case 'void':
      return (
        <>
          <circle cx="32" cy="32" r="32" fill="#1C1633" />
          <circle cx="32" cy="32" r="18" fill="#2C2548" />
          <circle cx="32" cy="32" r="8" fill="#C084FC" />
          <circle cx="32" cy="32" r="3" fill="#F3EAD6" />
        </>
      )
    case 'rose':
      return (
        <>
          <circle cx="32" cy="32" r="32" fill="#FF5A7A" />
          <circle cx="32" cy="36" r="14" fill="#F3EAD6" />
          <path d="M24 18 Q32 8 40 18 Q32 26 24 18" fill="#C084FC" />
          <circle cx="27" cy="36" r="2.5" fill="#1C1633" />
          <circle cx="37" cy="36" r="2.5" fill="#1C1633" />
        </>
      )
  }
}

export function AvatarPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (id: AvatarId) => void
}) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {AVATAR_IDS.map((id) => {
        const selected = value === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-label={AVATAR_LABELS[id]}
            className={`rounded-2xl p-1 ${selected ? 'bg-horizon' : 'bg-dusk ring-1 ring-white/10'}`}
          >
            <PlayerAvatar avatar={id} size={44} />
          </button>
        )
      })}
    </div>
  )
}
