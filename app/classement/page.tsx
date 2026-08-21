'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { sortCareers, type Career, type CareerSort } from '@/lib/career'

type Row = Career & { netLabel: string }

const SORTS: { id: CareerSort; label: string }[] = [
  { id: 'points', label: 'PTS' },
  { id: 'kills', label: 'KILLS' },
  { id: 'revives', label: 'RÉAS' },
  { id: 'firstKills', label: 'FK' },
  { id: 'netCents', label: 'NET' },
  { id: 'games', label: 'GAMES' },
]

export default function ClassementPage() {
  const [meId, setMeId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [sort, setSort] = useState<CareerSort>('points')
  const [error, setError] = useState('')

  useEffect(() => {
    void fetch('/api/classement')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) {
          setError(data.error ?? 'Connecte-toi')
          return
        }
        setMeId(data.meId)
        setRows(data.rows)
      })
  }, [])

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
      <p className="text-sm text-mute">Toi contre tes potes. Les stats viennent des games clôturées liées au compte.</p>
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
