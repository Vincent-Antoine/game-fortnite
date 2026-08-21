'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { CareerGrid } from '@/components/career-grid'
import { PresenceAvatar } from '@/components/presence-avatar'
import { isPlayerLive } from '@/lib/presence'

type Profile = {
  isSelf: boolean
  friendshipId: string | null
  user: { name: string; friendCode: string; photoData?: string | null; lastSeenAt?: string | null }
  kills: number
  revives: number
  points: number
  firstKills: number
  games: number
  sessions: number
  wonLabel: string
  lostLabel: string
  netLabel: string
}

export default function FriendProfilPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/joueurs/${params.code}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? 'Profil introuvable')
        return
      }
      if (data.isSelf) {
        router.replace('/profil')
        return
      }
      setProfile(data)
    }
    void load()
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void load()
      }
    }, 4000)
    return () => window.clearInterval(timer)
  }, [params.code, router])

  if (error && !profile) {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-8">
        <p>{error}</p>
        <Link href="/amis" className="mt-4 inline-block text-horizon underline">
          Retour aux amis
        </Link>
      </main>
    )
  }
  if (!profile) {
    return <main className="p-8 text-mute">Chargement…</main>
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-8">
      <p className="font-hud text-[11px] tracking-[0.35em] text-horizon">PROFIL AMI</p>
      <div className="flex items-center gap-4">
        <PresenceAvatar photoData={profile.user.photoData} lastSeenAt={profile.user.lastSeenAt} size={72} />
        <div>
          <h1 className="font-display text-5xl">{profile.user.name}</h1>
          <p className="font-hud tracking-[0.25em] text-gold">ID {profile.user.friendCode}</p>
          {isPlayerLive(profile.user.lastSeenAt) ? <p className="text-sm text-rez">En ligne</p> : null}
        </div>
      </div>
      {error ? <p className="rounded-2xl bg-kill/15 px-4 py-3 text-sm text-kill">{error}</p> : null}
      <CareerGrid stats={profile} />
      {profile.friendshipId ? (
        <Link
          href={`/amis/${profile.user.friendCode}`}
          className="rounded-full bg-horizon py-3 text-center font-semibold text-dusk"
        >
          Message
        </Link>
      ) : null}
      <Link href="/classement" className="text-sm text-horizon underline">
        Voir le classement
      </Link>
      {profile.friendshipId ? (
        <button
          type="button"
          disabled={pending}
          className="text-sm text-kill underline disabled:opacity-50"
          onClick={() => {
            if (!window.confirm(`Retirer ${profile.user.name} de tes amis ?`)) {
              return
            }
            setPending(true)
            void fetch(`/api/friends/${profile.friendshipId}`, { method: 'DELETE' })
              .then(async (response) => {
                const data = await response.json()
                if (!response.ok) {
                  throw new Error(data.error ?? 'Impossible de supprimer')
                }
                router.push('/amis')
              })
              .catch((err: Error) => {
                setError(err.message)
                setPending(false)
              })
          }}
        >
          {pending ? '…' : 'Supprimer cet ami'}
        </button>
      ) : null}
    </main>
  )
}
