'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Stats = {
  me: { name: string; friendCode: string; email: string }
  games: number
  sessions: number
  wonLabel: string
  lostLabel: string
  netLabel: string
  history: { code: string; wonCents: number; lostCents: number; games: number }[]
}

export default function ProfilPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void fetch('/api/profil')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) {
          setError(data.error ?? 'Connecte-toi')
          return
        }
        setStats(data)
      })
  }, [])

  if (error) {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-8">
        <p>{error}</p>
      </main>
    )
  }
  if (!stats) {
    return <main className="p-8 text-mute">Chargement…</main>
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-8">
      <h1 className="font-display text-5xl">{stats.me.name}</h1>
      <p className="font-hud tracking-[0.25em] text-gold">ID {stats.me.friendCode}</p>
      <p className="text-sm text-mute">Donne cet ID à tes potes pour t’ajouter.</p>
      <div className="grid grid-cols-2 gap-3">
        <article className="rounded-3xl bg-panel p-4">
          <p className="font-hud text-xs text-rez">GAGNÉ</p>
          <p className="font-display text-3xl">{stats.wonLabel}</p>
        </article>
        <article className="rounded-3xl bg-panel p-4">
          <p className="font-hud text-xs text-kill">PERDU</p>
          <p className="font-display text-3xl">{stats.lostLabel}</p>
        </article>
        <article className="rounded-3xl bg-panel p-4">
          <p className="font-hud text-xs text-mute">NET</p>
          <p className="font-display text-3xl">{stats.netLabel}</p>
        </article>
        <article className="rounded-3xl bg-panel p-4">
          <p className="font-hud text-xs text-mute">GAMES</p>
          <p className="font-display text-3xl">{stats.games}</p>
        </article>
      </div>
      <section>
        <h2 className="font-hud text-xs tracking-[0.25em] text-mute">SESSIONS</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {stats.history.map((row) => (
            <li key={row.code} className="rounded-2xl bg-panel px-4 py-3">
              <p className="font-hud tracking-widest">{row.code}</p>
              <p className="text-sm text-mute">
                {row.games} game(s) · +{(row.wonCents / 100).toFixed(2)} € · -{(row.lostCents / 100).toFixed(2)} €
              </p>
            </li>
          ))}
        </ul>
      </section>
      <button
        className="text-sm text-mute underline"
        onClick={async () => {
          await fetch('/api/auth/logout', { method: 'POST' })
          router.push('/')
          router.refresh()
        }}
      >
        Déconnexion
      </button>
    </main>
  )
}
