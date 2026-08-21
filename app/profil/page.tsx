'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CareerGrid } from '@/components/career-grid'
import { PhotoPicker } from '@/components/photo-picker'
import { PushToggle } from '@/components/push-toggle'

type Stats = {
  me: { name: string; friendCode: string; email: string; photoData: string | null }
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
  const [photoPending, setPhotoPending] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [namePending, setNamePending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [emailDraft, setEmailDraft] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [securityPending, setSecurityPending] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')

  async function load() {
    const response = await fetch('/api/profil')
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? 'Connecte-toi')
      return
    }
    setStats(data)
    setNameDraft(data.me.name)
    setEmailDraft(data.me.email)
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

  async function savePhoto(photoData: string | null) {
    if (!stats) {
      return
    }
    const previous = stats.me.photoData
    setStats({ ...stats, me: { ...stats.me, photoData } })
    setPhotoPending(true)
    setError('')
    try {
      const response = await fetch('/api/profil/photo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoData }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Photo impossible')
      }
      setStats((current) =>
        current ? { ...current, me: { ...current.me, photoData: data.photoData } } : current,
      )
    } catch (err) {
      setStats((current) => (current ? { ...current, me: { ...current.me, photoData: previous } } : current))
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setPhotoPending(false)
    }
  }

  async function saveName() {
    if (!stats) {
      return
    }
    const next = nameDraft.trim()
    if (!next || next === stats.me.name) {
      return
    }
    setNamePending(true)
    setError('')
    try {
      const response = await fetch('/api/profil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: next }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Pseudo impossible')
      }
      setStats((current) => (current ? { ...current, me: { ...current.me, name: data.name } } : current))
      setNameDraft(data.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setNamePending(false)
    }
  }

  async function saveSecurity() {
    setSecurityPending(true)
    setError('')
    try {
      const response = await fetch('/api/profil/security', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          email: emailDraft !== stats?.me.email ? emailDraft : undefined,
          password: newPassword || undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Impossible')
      }
      setCurrentPassword('')
      setNewPassword('')
      if (data.email) {
        setStats((current) => (current ? { ...current, me: { ...current.me, email: data.email } } : current))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSecurityPending(false)
    }
  }

  async function wipeAccount() {
    if (!window.confirm('Supprimer définitivement ton compte ?')) {
      return
    }
    setError('')
    try {
      const response = await fetch('/api/profil', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Suppression impossible')
      }
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
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
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void saveName()
        }}
      >
        <input
          value={nameDraft}
          maxLength={20}
          onChange={(event) => setNameDraft(event.target.value)}
          className="flex-1 rounded-full bg-panel px-4 py-3"
        />
        <button
          disabled={namePending || nameDraft.trim() === stats.me.name || nameDraft.trim().length < 1}
          className="rounded-full bg-horizon px-4 font-semibold text-dusk disabled:opacity-50"
        >
          {namePending ? '…' : 'OK'}
        </button>
      </form>
      <p className="text-sm text-mute">Donne cet ID à tes potes pour t’ajouter. Le pseudo sert pour les prochaines sessions.</p>
      <button
        type="button"
        className="text-left text-sm text-horizon underline"
        onClick={() => {
          const url = `${window.location.origin}/ami/${stats.me.friendCode}`
          void navigator.clipboard.writeText(url).then(() => setCopied(true))
        }}
      >
        {copied ? 'Lien copié' : 'Copier le lien d’ajout (iMessage)'}
      </button>
      {error ? <p className="rounded-2xl bg-kill/15 px-4 py-3 text-sm text-kill">{error}</p> : null}
      <PhotoPicker
        value={stats.me.photoData}
        onChange={(photoData) => {
          if (!photoPending) {
            void savePhoto(photoData)
          }
        }}
        hint="Sur ton compte. Elle sera préremplie quand tu crées ou rejoins une session."
      />
      <PushToggle />
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
      <section className="rounded-3xl bg-panel p-4">
        <p className="font-hud text-xs tracking-[0.2em] text-gold">EMAIL / MOT DE PASSE</p>
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void saveSecurity()
          }}
        >
          <input
            type="email"
            value={emailDraft}
            onChange={(event) => setEmailDraft(event.target.value)}
            className="rounded-full bg-dusk px-4 py-3"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Nouveau mot de passe (optionnel)"
            className="rounded-full bg-dusk px-4 py-3"
          />
          <input
            required
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Mot de passe actuel"
            className="rounded-full bg-dusk px-4 py-3"
          />
          <button disabled={securityPending} className="rounded-full bg-horizon py-3 font-semibold text-dusk disabled:opacity-50">
            {securityPending ? '…' : 'Enregistrer'}
          </button>
        </form>
      </section>
      <section className="rounded-3xl bg-panel p-4">
        <p className="font-hud text-xs tracking-[0.2em] text-kill">SUPPRIMER LE COMPTE</p>
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void wipeAccount()
          }}
        >
          <input
            required
            type="password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            placeholder="Ton mot de passe"
            className="rounded-full bg-dusk px-4 py-3"
          />
          <button className="text-sm text-kill underline">Supprimer définitivement</button>
        </form>
      </section>
    </main>
  )
}
