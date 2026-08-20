'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AvatarPicker, PlayerAvatar } from '@/components/avatar'
import { formatCents } from '@/lib/money'
import type { SessionDTO } from '@/lib/types'

type Props = { code: string }

type PlayerRef = SessionDTO['players'][number]

export function SessionView({ code }: Props) {
  const [session, setSession] = useState<SessionDTO | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState('')
  const [newName, setNewName] = useState('')
  const [newAvatar, setNewAvatar] = useState('drop')
  const skipPoll = useRef(0)
  const saveTimer = useRef(0)

  const load = useCallback(async () => {
    if (Date.now() < skipPoll.current) {
      return
    }
    const response = await fetch(`/api/sessions/${code}`, { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? 'Chargement impossible')
      return
    }
    setError('')
    setSession(data)
  }, [code])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void load()
      }
    }, 2000)
    return () => window.clearInterval(timer)
  }, [load])

  const names = useMemo(() => {
    const map = new Map<string, PlayerRef>()
    session?.players.forEach((player) => map.set(player.id, player))
    return map
  }, [session])

  const openGame = session?.games.find((game) => game.status === 'open')
  const closedGames = session?.games.filter((game) => game.status === 'closed') ?? []
  const board = useMemo(() => (session ? liveBoard(session) : []), [session])

  async function mutate(path: string, init?: RequestInit) {
    setError('')
    const response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error ?? 'Action impossible')
    }
    skipPoll.current = Date.now() + 1200
    setSession(data)
    return data as SessionDTO
  }

  async function run(label: string, action: () => Promise<unknown>) {
    setPending(label)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setPending('')
    }
  }

  function scheduleSave(next: SessionDTO) {
    setSession(next)
    skipPoll.current = Date.now() + 1500
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      const game = next.games.find((row) => row.status === 'open')
      if (!game) {
        return
      }
      void mutate(`/api/sessions/${code}/games/${game.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          firstKillPlayerId: game.firstKillPlayerId,
          scores: game.scores,
        }),
      }).catch((err: Error) => setError(err.message))
    }, 280) as unknown as number
  }

  function bump(playerId: string, field: 'kills' | 'revives', delta: number) {
    if (!session || !openGame) {
      return
    }
    const scores = openGame.scores.map((row) =>
      row.playerId === playerId
        ? { ...row, [field]: Math.max(0, Math.min(99, row[field] + delta)) }
        : row,
    )
    scheduleSave({
      ...session,
      games: session.games.map((game) => (game.id === openGame.id ? { ...game, scores } : game)),
    })
  }

  function setFirstKill(playerId: string) {
    if (!session || !openGame) {
      return
    }
    const firstKillPlayerId = openGame.firstKillPlayerId === playerId ? null : playerId
    scheduleSave({
      ...session,
      games: session.games.map((game) =>
        game.id === openGame.id ? { ...game, firstKillPlayerId } : game,
      ),
    })
  }

  async function copyCode() {
    await navigator.clipboard.writeText(code)
  }

  if (!session) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center px-6">
        <p className="font-hud tracking-[0.3em] text-mute">{error || 'CHARGEMENT'}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col gap-6 px-4 pb-16 pt-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-hud text-[11px] tracking-[0.35em] text-horizon">DETTE ROYALE</p>
          <button type="button" onClick={() => void copyCode()} className="mt-1 font-hud text-4xl tracking-[0.28em]">
            {session.code}
          </button>
          <p className="mt-1 text-sm text-mute">Mise {formatCents(session.stakeCents)} · tape le code pour copier</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 font-hud text-xs tracking-widest ${session.status === 'open' ? 'bg-rez/20 text-rez' : 'bg-mute/20 text-mute'}`}
        >
          {session.status === 'open' ? 'LIVE' : 'CLOS'}
        </span>
      </header>

      {error ? <p className="rounded-2xl bg-kill/15 px-4 py-3 text-sm text-kill">{error}</p> : null}

      <Scoreboard rows={board} youPlayerId={session.youPlayerId} hasOpenGame={Boolean(openGame)} />

      {openGame ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-4xl tracking-wide">GAME {String(openGame.index).padStart(2, '0')}</h2>
            <p className="text-sm text-mute">First kill départage</p>
          </div>
          {session.players.map((player) => {
            const score = openGame.scores.find((row) => row.playerId === player.id) ?? {
              playerId: player.id,
              kills: 0,
              revives: 0,
            }
            const points = score.kills + score.revives
            const isFirst = openGame.firstKillPlayerId === player.id
            return (
              <article
                key={player.id}
                className="overflow-hidden rounded-3xl bg-panel"
                style={{ boxShadow: `inset 6px 0 0 ${player.color}` }}
              >
                <div className="px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <PlayerAvatar avatar={player.avatar} size={48} />
                      <div>
                        <p className="text-lg font-semibold">
                          {player.name}
                          {session.youPlayerId === player.id ? ' · toi' : ''}
                        </p>
                        <p className="font-hud text-xs tracking-widest text-mute">{points} PTS</p>
                      </div>
                    </div>
                    <p className="font-display text-5xl leading-none">{points}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Stepper label="Kills" value={score.kills} accent="kill" onChange={(delta) => bump(player.id, 'kills', delta)} />
                    <Stepper label="Réas" value={score.revives} accent="rez" onChange={(delta) => bump(player.id, 'revives', delta)} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFirstKill(player.id)}
                    className={`mt-3 w-full rounded-full py-2 font-hud text-xs tracking-[0.2em] ${isFirst ? 'bg-gold text-dusk' : 'bg-dusk text-mute'}`}
                  >
                    {isFirst ? 'FIRST KILL' : 'MARQUER FIRST KILL'}
                  </button>
                </div>
              </article>
            )
          })}
          <button
            disabled={pending !== '' || session.status !== 'open'}
            onClick={() => void run('close-game', () => mutate(`/api/sessions/${code}/games/${openGame.id}/close`, { method: 'POST' }))}
            className="rounded-full bg-horizon py-4 text-lg font-semibold text-dusk disabled:opacity-50"
          >
            {pending === 'close-game' ? 'Calcul…' : 'Clôturer la game'}
          </button>
        </section>
      ) : session.status === 'open' ? (
        <button
          disabled={pending !== '' || session.players.length < 2}
          onClick={() => void run('new-game', () => mutate(`/api/sessions/${code}/games`, { method: 'POST' }))}
          className="rounded-full bg-horizon py-4 text-lg font-semibold text-dusk disabled:opacity-50"
        >
          {pending === 'new-game' ? '…' : session.players.length < 2 ? 'Ajoute un 2e joueur' : 'Ouvrir une game'}
        </button>
      ) : null}

      <Ticket session={session} names={names} />

      {closedGames.length > 0 ? (
        <section>
          <h3 className="font-hud text-xs tracking-[0.25em] text-mute">GAMES JOUÉES</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {closedGames.map((game) => (
              <li key={game.id} className="rounded-2xl bg-panel/80 px-4 py-3 text-sm">
                <p className="font-semibold">Game {game.index}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {session.players.map((player) => {
                    const score = game.scores.find((row) => row.playerId === player.id)
                    const points = (score?.kills ?? 0) + (score?.revives ?? 0)
                    return (
                      <span key={player.id} className="flex items-center gap-1.5">
                        <PlayerAvatar avatar={player.avatar} size={20} />
                        {player.name} {points}
                      </span>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {session.status === 'open' ? (
        <form
          className="flex flex-col gap-3 rounded-3xl bg-panel p-4"
          onSubmit={(event) => {
            event.preventDefault()
            void run('add', async () => {
              await mutate(`/api/sessions/${code}/players`, {
                method: 'POST',
                body: JSON.stringify({ name: newName, avatar: newAvatar }),
              })
              setNewName('')
            })
          }}
        >
          <span className="font-hud text-xs tracking-[0.2em] text-mute">AJOUTER UN POTE</span>
          <AvatarPicker value={newAvatar} onChange={setNewAvatar} />
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Pseudo"
              maxLength={20}
              className="flex-1 rounded-full border border-white/10 bg-dusk px-4 py-3 outline-none"
            />
            <button className="rounded-full bg-horizon px-4 font-semibold text-dusk">OK</button>
          </div>
        </form>
      ) : null}

      {session.status === 'open' ? (
        <button
          disabled={pending !== '' || Boolean(openGame)}
          onClick={() => {
            if (window.confirm('Clôturer la session ? Plus de nouvelles games.')) {
              void run('close-session', () => mutate(`/api/sessions/${code}/close`, { method: 'POST' }))
            }
          }}
          className="text-sm text-mute underline disabled:opacity-40"
        >
          Clôturer la session
        </button>
      ) : (
        <p className="text-center text-sm text-mute">Soirée close. Le ticket reste valable.</p>
      )}
    </main>
  )
}

function liveBoard(session: SessionDTO) {
  const openGame = session.games.find((game) => game.status === 'open')
  return session.players
    .map((player) => {
      const gameScore = openGame?.scores.find((row) => row.playerId === player.id)
      const gamePoints = (gameScore?.kills ?? 0) + (gameScore?.revives ?? 0)
      const nightPoints = session.games.reduce((sum, game) => {
        const row = game.scores.find((score) => score.playerId === player.id)
        return sum + (row ? row.kills + row.revives : 0)
      }, 0)
      return {
        player,
        gameKills: gameScore?.kills ?? 0,
        gameRevives: gameScore?.revives ?? 0,
        gamePoints,
        nightPoints,
        firstKill: openGame?.firstKillPlayerId === player.id,
      }
    })
    .sort((a, b) => b.gamePoints - a.gamePoints || b.nightPoints - a.nightPoints)
}

function Scoreboard({
  rows,
  youPlayerId,
  hasOpenGame,
}: {
  rows: ReturnType<typeof liveBoard>
  youPlayerId: string | null
  hasOpenGame: boolean
}) {
  return (
    <section className="sticky top-0 z-10 -mx-4 bg-dusk/85 px-4 py-3 backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-hud text-[11px] tracking-[0.3em] text-gold">SCORES LIVE</h2>
        <p className="font-hud text-[10px] tracking-widest text-mute">
          {hasOpenGame ? 'GAME · SOIRÉE' : 'SOIRÉE'}
        </p>
      </div>
      <ol className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li
            key={row.player.id}
            className="flex items-center gap-3 rounded-2xl bg-panel px-3 py-2"
            style={{ boxShadow: `inset 4px 0 0 ${row.player.color}` }}
          >
            <span className="w-5 font-hud text-sm text-mute">{index + 1}</span>
            <PlayerAvatar avatar={row.player.avatar} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {row.player.name}
                {youPlayerId === row.player.id ? ' · toi' : ''}
                {row.firstKill ? ' · FK' : ''}
              </p>
              {hasOpenGame ? (
                <p className="font-hud text-[10px] tracking-wide text-mute">
                  {row.gameKills}K · {row.gameRevives}R
                </p>
              ) : null}
            </div>
            <div className="text-right">
              {hasOpenGame ? (
                <p className="font-display text-2xl leading-none">{row.gamePoints}</p>
              ) : null}
              <p className={`font-hud text-xs ${hasOpenGame ? 'text-mute' : 'font-display text-2xl text-ink'}`}>
                {hasOpenGame ? `${row.nightPoints} soirée` : row.nightPoints}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Stepper({
  label,
  value,
  accent,
  onChange,
}: {
  label: string
  value: number
  accent: 'kill' | 'rez'
  onChange: (delta: number) => void
}) {
  const color = accent === 'kill' ? 'text-kill' : 'text-rez'
  return (
    <div className="rounded-2xl bg-dusk px-3 py-3">
      <p className={`font-hud text-[10px] tracking-[0.2em] ${color}`}>{label.toUpperCase()}</p>
      <div className="mt-1 flex items-center justify-between">
        <button type="button" onClick={() => onChange(-1)} className="h-10 w-10 rounded-full bg-panel text-xl">
          −
        </button>
        <span className="font-display text-3xl">{value}</span>
        <button type="button" onClick={() => onChange(1)} className="h-10 w-10 rounded-full bg-panel text-xl">
          +
        </button>
      </div>
    </div>
  )
}

function Ticket({
  session,
  names,
}: {
  session: SessionDTO
  names: Map<string, PlayerRef>
}) {
  return (
    <section className="receipt rounded-sm px-5 py-6 shadow-2xl">
      <p className="font-hud text-center text-[11px] tracking-[0.35em]">TICKET DE SOIRÉE</p>
      <p className="mt-1 text-center font-display text-3xl tracking-wide">{session.code}</p>
      <p className="mt-1 text-center text-xs opacity-70">
        {session.games.filter((game) => game.status === 'closed').length} game(s) · mise {formatCents(session.stakeCents)}
      </p>
      <div className="my-4 border-t border-dashed border-paper-ink/30" />
      {session.ticket.length === 0 ? (
        <p className="text-center text-sm">Personne ne doit rien. Pour l’instant.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {session.ticket.map((row) => {
            const from = names.get(row.fromPlayerId)
            const to = names.get(row.toPlayerId)
            return (
              <li key={`${row.fromPlayerId}-${row.toPlayerId}`} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm leading-5">
                  {from ? <PlayerAvatar avatar={from.avatar} size={22} /> : null}
                  {from?.name ?? '???'}
                  <span className="opacity-50">→</span>
                  {to ? <PlayerAvatar avatar={to.avatar} size={22} /> : null}
                  {to?.name ?? '???'}
                </span>
                <span className="font-display text-2xl leading-none">{formatCents(row.amountCents)}</span>
              </li>
            )
          })}
        </ul>
      )}
      <div className="my-4 border-t border-dashed border-paper-ink/30" />
      <p className="text-center font-hud text-[10px] tracking-[0.25em] opacity-60">MERCI D’AVOIR DROP</p>
    </section>
  )
}
