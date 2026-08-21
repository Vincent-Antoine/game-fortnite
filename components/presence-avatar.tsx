import { PlayerAvatar } from '@/components/avatar'
import { isPlayerLive } from '@/lib/presence'

export function PresenceAvatar({
  photoData,
  lastSeenAt,
  size = 40,
  className,
}: {
  photoData?: string | null
  lastSeenAt?: string | Date | null
  size?: number
  className?: string
}) {
  const live = isPlayerLive(lastSeenAt)
  return (
    <span className={`relative inline-block shrink-0 ${className ?? ''}`}>
      <PlayerAvatar avatar="drop" photoData={photoData} size={size} />
      {live ? (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-rez ring-2 ring-panel" />
      ) : null}
    </span>
  )
}
