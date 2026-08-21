'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PresenceAvatar } from '@/components/presence-avatar'
import { sortCareers, type Career, type CareerSort } from '@/lib/career'
import { type SeasonRange } from '@/lib/season'

type Row = Career & { netLabel: string; photoData?: string | null; lastSeenAt?: string | null }

const SORTS: { id: CareerSort; label: string }[] = [
  { id: 'points', label: 'PTS' },
  { id: 'kills', label: 'KILLS' },
  { id: 'revives', label: 'RÉAS' },
  { id: 'firstKills', label: 'FK' },
  { id: 'netCents', label: 'NET' },
  { id: 'games', label: 'GAMES' },
]

const RANGES: { id: SeasonRange; label: string }[] = [
  { id: 'week', label: 'SEMAINE' },
  { id: 'month', label: 'MOIS' },
  { id: 'all', label: 'TOUT' },
]

export default function ClassementPage() {
  const [meId, setMeId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [sort, setSort] = useState<CareerSort>('points')
  const [range, setRange] = useState<SeasonRange>('month')
  const [error, setError] = useState('')
  const monthLabel = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(new Date())

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/classement?range=${range}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? 'Connecte-toi')
        return
      }
      setError('')
      setMeId(data.meId)
      setRows(data.rows)
    }
    void load()
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void load()
      }
    }, 4000)
    return () => window.clearInterval(timer)
  }, [range])

  const ranked = useMemo(() => sortCareers(rows, sort), [rows, sort])

  if (error) {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-8">
        <p>{error}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-8">
      <p className="font-hud text-[11px] tracking-[0.35em] text-horizon">SQUAD</p>
      <h1 className="font-display text-5xl">CLASSEMENT</h1>
      <p className="text-sm text-mute">
        {range === 'month' ? `Saison ${monthLabel}` : range === 'week' ? 'Cette semaine' : 'Depuis toujours'}. Games
        clôturées liées au compte.
      </p>
      <div className="flex flex-wrap gap-2">
        {RANGES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setRange(option.id)}
            className={`rounded-full px-3 py-1.5 font-hud text-xs tracking-widest ${
              range === option.id ? 'bg-gold text-dusk' : 'bg-panel text-mute'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {SORTS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSort(option.id)}
            className={`rounded-full px-3 py-1.5 font-hud text-xs tracking-widest ${
              sort === option.id ? 'bg-horizon text-dusk' : 'bg-panel text-mute'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {ranked.length === 0 ? (
        <p className="text-mute">Chargement…</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {ranked.map((row, index) => (
            <li key={row.userId}>
              <Link
                href={row.userId === meId ? '/profil' : `/profil/${row.friendCode}`}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
                  row.userId === meId ? 'bg-horizon/20 ring-1 ring-horizon' : 'bg-panel'
                }`}
              >
                <span
                  className={`w-8 font-display text-2xl ${
                    index === 0 ? 'text-gold' : index === 1 ? 'text-horizon' : 'text-mute'
                  }`}
                >
                  {index + 1}
                </span>
                <PresenceAvatar photoData={row.photoData} lastSeenAt={row.lastSeenAt} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {row.name}
                    {row.userId === meId ? ' · toi' : ''}
                  </p>
                  <p className="font-hud text-[10px] tracking-widest text-mute">{row.friendCode}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-3xl leading-none">{metric(row, sort)}</p>
                  <p className="text-xs text-mute">
                    {row.kills}K · {row.revives}R · {row.games}G
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
      {ranked.length === 1 ? (
        <p className="text-sm text-mute">
          Ajoute des amis pour comparer.{' '}
          <Link href="/amis" className="text-horizon underline">
            Ouvrir Amis
          </Link>
        </p>
      ) : null}
    </main>
  )
}

function metric(row: Row, sort: CareerSort): string | number {
  if (sort === 'netCents') {
    return row.netLabel
  }
  return row[sort]
}
