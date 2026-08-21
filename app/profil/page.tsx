'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CareerGrid } from '@/components/career-grid'

type Stats = {
  me: { name: string; friendCode: string; email: string }
  games: number
  sessions: number
  kills: number
  revives: number
  points: number
  firstKills: number
  wonLabel: string
  lostLabel: string
  netLabel: string
  bestGame: number
  winStreak: number
  worstNightLabel: string
  history: { code: string; wonCents: number; lostCents: number; games: number; isHost: boolean }[]
}

export default function ProfilPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')
  const [pendingCode, setPendingCode] = useState('')

  async function load() {
    const response = await fetch('/api/profil')
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? 'Connecte-toi')
      return
    }
    setStats(data)
  }

  useEffect(() => {
    void load()
  }, [])

  async function removeSession(row: Stats['history'][number]) {
    const message = row.isHost
      ? 'Tu as créé cette session. La supprimer l’efface pour tout le monde. Continuer ?'
      : 'Retirer cette session de ton historique ? Les autres la conservent.'
    if (!window.confirm(message)) {
      return
    }
    setPendingCode(row.code)
    setError('')
    try {
      const response = await fetch(`/api/profil/sessions/${row.code}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Suppression impossible')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setPendingCode('')
    }
  }

  if (error && !stats) {
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
      <p className="text-sm text-mute">Donne cet ID à tes potes pour t’ajouter. Tes kills et réas restent sur ce profil.</p>
      {error ? <p className="rounded-2xl bg-kill/15 px-4 py-3 text-sm text-kill">{error}</p> : null}
      <CareerGrid stats={stats} />
      <Link href="/classement" className="text-sm text-horizon underline">
        Voir le classement
      </Link>
      <section>
        <h2 className="font-hud text-xs tracking-[0.25em] text-mute">SESSIONS</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {stats.history.length === 0 ? (
            <li className="rounded-2xl bg-panel px-4 py-3 text-sm text-mute">Aucune session pour l’instant.</li>
          ) : null}
          {stats.history.map((row) => (
            <li key={row.code} className="flex items-center gap-3 rounded-2xl bg-panel px-4 py-3">
              <Link href={`/session/${row.code}#historique`} className="min-w-0 flex-1">
                <p className="font-hud tracking-widest">{row.code}</p>
                <p className="text-sm text-mute">
                  {row.isHost ? 'Hôte · ' : ''}
                  {row.games} game(s) · +{(row.wonCents / 100).toFixed(2)} € · -{(row.lostCents / 100).toFixed(2)} €
                </p>
                <p className="mt-1 text-xs text-horizon">Voir l’historique</p>
              </Link>
              <button
                type="button"
                disabled={pendingCode === row.code}
                className="shrink-0 text-sm text-kill underline disabled:opacity-50"
                onClick={() => void removeSession(row)}
              >
                {pendingCode === row.code ? '…' : 'Supprimer'}
              </button>
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
