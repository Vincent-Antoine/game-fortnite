'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AvatarPicker } from '@/components/avatar'
import { PhotoPicker } from '@/components/photo-picker'
import { parseStakeToCents } from '@/lib/money'

type Mode = 'create' | 'join'

export function HomeView() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('create')
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('drop')
  const [photoData, setPhotoData] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [stake, setStake] = useState('0,25')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const stakeCents = useMemo(() => parseStakeToCents(stake), [stake])

  useEffect(() => {
    void fetch('/api/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.user?.name) {
          setName((current) => current || data.user.name)
        }
        if (data?.user?.photoData) {
          setPhotoData((current) => current ?? data.user.photoData)
        }
      })
      .catch(() => undefined)
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      if (mode === 'create') {
        if (stakeCents === null) {
          throw new Error('Mise entre 0,01 € et 50 €')
        }
        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, avatar, photoData, stakeCents }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error ?? 'Création impossible')
        }
        router.push(`/session/${data.code}`)
        return
      }
      const response = await fetch(`/api/sessions/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, avatar, photoData }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Impossible de rejoindre')
      }
      router.push(`/session/${data.code}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col px-5 pb-10 pt-12">
      <p className="font-hud text-[11px] tracking-[0.35em] text-horizon">SOIRÉE SQUAD</p>
      <h1 className="mt-3 font-display text-6xl leading-[0.9] tracking-wide text-ink">
        DETTE
        <br />
        ROYALE
      </h1>
      <p className="mt-4 max-w-xs text-base leading-6 text-mute">
        Un kill = 1 pt. Une réa = 1 pt. Le dernier paie les points du premier.
      </p>

      <div className="mt-10 grid grid-cols-2 rounded-full bg-panel p-1">
        <button
          type="button"
          onClick={() => setMode('create')}
          className={`rounded-full py-3 text-sm font-semibold ${mode === 'create' ? 'bg-horizon text-dusk' : 'text-mute'}`}
        >
          Créer
        </button>
        <button
          type="button"
          onClick={() => setMode('join')}
          className={`rounded-full py-3 text-sm font-semibold ${mode === 'join' ? 'bg-horizon text-dusk' : 'text-mute'}`}
        >
          Rejoindre
        </button>
      </div>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="font-hud text-xs tracking-[0.2em] text-mute">PSEUDO</span>
          <input
            required
            maxLength={20}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Brandon"
            className="rounded-2xl border border-white/10 bg-dusk px-4 py-4 text-lg outline-none ring-horizon focus:ring-2"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="font-hud text-xs tracking-[0.2em] text-mute">AVATAR</span>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </div>

        <PhotoPicker value={photoData} onChange={setPhotoData} />

        {mode === 'create' ? (
          <label className="flex flex-col gap-2">
            <span className="font-hud text-xs tracking-[0.2em] text-mute">MISE PAR POINT DU GAGNANT</span>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-dusk px-4 py-3">
              <input
                inputMode="decimal"
                value={stake}
                onChange={(event) => setStake(event.target.value)}
                className="w-full bg-transparent text-lg outline-none"
              />
              <span className="text-mute">€</span>
            </div>
          </label>
        ) : (
          <label className="flex flex-col gap-2">
            <span className="font-hud text-xs tracking-[0.2em] text-mute">CODE</span>
            <input
              required
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="K7P2"
              maxLength={8}
              className="rounded-2xl border border-white/10 bg-dusk px-4 py-4 font-hud text-3xl tracking-[0.4em] outline-none ring-horizon focus:ring-2"
            />
          </label>
        )}

        {error ? <p className="text-sm text-kill">{error}</p> : null}

        <button
          disabled={pending}
          className="mt-2 rounded-full bg-horizon py-4 text-lg font-semibold text-dusk disabled:opacity-60"
        >
          {pending ? '…' : mode === 'create' ? 'Ouvrir la session' : 'Entrer dans la session'}
        </button>
      </form>
    </main>
  )
}
