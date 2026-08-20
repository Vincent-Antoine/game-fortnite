'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AvatarPicker, PlayerAvatar } from '@/components/avatar'
import { compressPhoto } from '@/lib/compress-photo'
import { formatCents } from '@/lib/money'
import { modifiedPoints } from '@/lib/scoring'
import type { SessionDTO } from '@/lib/types'

type Props = { code: string }

type PlayerRef = SessionDTO['players'][number]

export function SessionView({ code }: Props) {
  const [session, setSession] = useState<SessionDTO | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [meUser, setMeUser] = useState<{ name: string } | null>(null)
  const [joinName, setJoinName] = useState('')
  const [joinAvatar, setJoinAvatar] = useState('drop')
  const [pending, setPending] = useState('')
  const [newName, setNewName] = useState('')
  const [newAvatar, setNewAvatar] = useState('drop')
  const [friends, setFriends] = useState<{ user: { id: string; name: string }; status: string }[]>([])
  const skipPoll = useRef(0)
  const saveTimer = useRef(0)
  const pendingDeltas = useRef<Record<string, { kills: number; revives: number }>>({})
  const flushTimer = useRef(0)
  const sessionRef = useRef<SessionDTO | null>(null)
  sessionRef.current = session

  const mergeRemote = useCallback((remote: SessionDTO) => {
    const local = sessionRef.current
    const pending = pendingDeltas.current
    if (!local || Object.keys(pending).length === 0) {
      return remote
    }
    const localOpen = local.games.find((game) => game.status === 'open')
    const remoteOpen = remote.games.find((game) => game.status === 'open')
    if (!localOpen || !remoteOpen) {
      return remote
    }
    return {
      ...remote,
      games: remote.games.map((game) =>
        game.id === remoteOpen.id
          ? {
              ...game,
              scores: game.scores.map((row) => {
                if (!pending[row.playerId]) {
                  return row
                }
                return localOpen.scores.find((score) => score.playerId === row.playerId) ?? row
              }),
            }
          : game,
      ),
    }
  }, [])

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
    setSession(mergeRemote(data))
  }, [code, mergeRemote])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void load()
      }
    }, 2000)
    void fetch('/api/friends')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.friends) {
          setFriends(data.friends.filter((row: { status: string }) => row.status === 'accepted'))
        }
      })
      .catch(() => undefined)
    void fetch('/api/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.user) {
          setMeUser(data.user)
          setJoinName(data.user.name)
        }
      })
      .catch(() => undefined)
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
          scores: [],
        }),
      }).catch((err: Error) => setError(err.message))
    }, 280) as unknown as number
  }

  function flushNudges() {
    const game = sessionRef.current?.games.find((row) => row.status === 'open')
    if (!game) {
      return
    }
    const queued = pendingDeltas.current
    pendingDeltas.current = {}
    for (const [playerId, delta] of Object.entries(queued)) {
      if (delta.kills === 0 && delta.revives === 0) {
        continue
      }
      void fetch(`/api/sessions/${code}/games/${game.id}/nudge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          killsDelta: delta.kills,
          revivesDelta: delta.revives,
        }),
      })
        .then(async (response) => {
          const data = await response.json()
          if (!response.ok) {
            throw new Error(data.error ?? 'Score non enregistré')
          }
          setSession(mergeRemote(data))
        })
        .catch((err: Error) => setError(err.message))
    }
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
    const current = pendingDeltas.current[playerId] ?? { kills: 0, revives: 0 }
    current[field] += delta
    pendingDeltas.current[playerId] = current
    setSession({
      ...session,
      games: session.games.map((game) => (game.id === openGame.id ? { ...game, scores } : game)),
    })
    window.clearTimeout(flushTimer.current)
    flushTimer.current = window.setTimeout(flushNudges, 140) as unknown as number
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
      {toast ? <p className="rounded-2xl bg-rez/15 px-4 py-3 text-sm text-rez">{toast}</p> : null}

      {!session.youPlayerId && session.status === 'open' ? (
        <section className="rounded-3xl bg-horizon p-5 text-dusk">
          <p className="font-display text-3xl">REJOINS LA SESSION</p>
          <p className="mt-1 text-sm opacity-80">Tu vois la soirée, mais tu n’es pas encore dans le squad.</p>
          {meUser ? (
            <button
              className="mt-4 w-full rounded-full bg-dusk py-3 font-semibold text-ink"
              disabled={pending !== ''}
              onClick={() =>
                void run('join', async () => {
                  const response = await fetch(`/api/sessions/${code}/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: meUser.name, avatar: joinAvatar }),
                  })
                  const data = await response.json()
                  if (!response.ok) {
                    throw new Error(data.error ?? 'Impossible de rejoindre')
                  }
                  setSession(data)
                  setToast('Tu as rejoint la session')
                })
              }
            >
              Rejoindre avec {meUser.name}
            </button>
          ) : (
            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                void run('join', async () => {
                  const response = await fetch(`/api/sessions/${code}/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: joinName, avatar: joinAvatar }),
                  })
                  const data = await response.json()
                  if (!response.ok) {
                    throw new Error(data.error ?? 'Impossible de rejoindre')
                  }
                  setSession(data)
                  setToast('Tu as rejoint la session')
                })
              }}
            >
              <AvatarPicker value={joinAvatar} onChange={setJoinAvatar} />
              <input
                required
                value={joinName}
                onChange={(event) => setJoinName(event.target.value)}
                placeholder="Ton pseudo"
                className="rounded-full bg-dusk px-4 py-3 text-ink outline-none"
              />
              <button className="rounded-full bg-dusk py-3 font-semibold text-ink">Rejoindre</button>
            </form>
          )}
        </section>
      ) : null}

      {session.youPlayerId ? (
        <section className="flex items-center gap-4 rounded-3xl bg-panel p-4">
          <label className="relative shrink-0 cursor-pointer">
            <PlayerAvatar
              avatar={session.players.find((player) => player.id === session.youPlayerId)?.avatar ?? 'drop'}
              photoData={session.players.find((player) => player.id === session.youPlayerId)?.photoData}
              size={72}
            />
            <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-horizon text-sm font-bold text-dusk">
              +
            </span>
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file || !session.youPlayerId) {
                  return
                }
                void compressPhoto(file).then((photoData) =>
                  run('photo', () =>
                    mutate(`/api/sessions/${code}/photo`, {
                      method: 'POST',
                      body: JSON.stringify({ playerId: session.youPlayerId, photoData }),
                    }),
                  ),
                )
              }}
            />
          </label>
          <div>
            <p className="font-semibold">Ta photo de session</p>
            <p className="text-sm text-mute">Tape le cercle pour ajouter ou changer ta photo. Elle disparaît à la fin de la soirée.</p>
          </div>
        </section>
      ) : null}

      <Scoreboard rows={board} youPlayerId={session.youPlayerId} hasOpenGame={Boolean(openGame)} />

      {openGame ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-4xl tracking-wide">GAME {String(openGame.index).padStart(2, '0')}</h2>
            <p className="text-sm text-mute">First kill départage</p>
          </div>
          {!openGame.powersLocked ? (
            <div className="rounded-3xl bg-panel p-4">
              <p className="font-hud text-xs tracking-[0.2em] text-gold">POUVOIRS · 1 FOIS / SESSION</p>
              <p className="mt-1 text-sm text-mute">x2 ton score · /2 un adversaire · bouclier (le 2e paie)</p>
              {session.players.map((player) => (
                <div key={player.id} className="mt-3 flex flex-wrap gap-2">
                  <span className="w-full text-sm font-semibold">{player.name}</span>
                  <button
                    type="button"
                    disabled={player.usedPowers.double}
                    onClick={() => void run('power', () => mutate(`/api/sessions/${code}/games/${openGame.id}/powers`, { method: 'POST', body: JSON.stringify({ playerId: player.id, kind: 'double' }) }))}
                    className="rounded-full bg-dusk px-3 py-1 text-xs disabled:opacity-30"
                  >
                    x2
                  </button>
                  <button
                    type="button"
                    disabled={player.usedPowers.shield}
                    onClick={() => void run('power', () => mutate(`/api/sessions/${code}/games/${openGame.id}/powers`, { method: 'POST', body: JSON.stringify({ playerId: player.id, kind: 'shield' }) }))}
                    className="rounded-full bg-dusk px-3 py-1 text-xs disabled:opacity-30"
                  >
                    Bouclier
                  </button>
                  {session.players
                    .filter((target) => target.id !== player.id)
                    .map((target) => (
                      <button
                        key={target.id}
                        type="button"
                        disabled={player.usedPowers.halve}
                        onClick={() => void run('power', () => mutate(`/api/sessions/${code}/games/${openGame.id}/powers`, { method: 'POST', body: JSON.stringify({ playerId: player.id, kind: 'halve', targetPlayerId: target.id }) }))}
                        className="rounded-full bg-dusk px-3 py-1 text-xs disabled:opacity-30"
                      >
                        /2 {target.name}
                      </button>
                    ))}
                </div>
              ))}
              <button
                type="button"
                className="mt-4 w-full rounded-full bg-gold py-3 font-semibold text-dusk"
                onClick={() => void run('lock', () => mutate(`/api/sessions/${code}/games/${openGame.id}/powers/lock`, { method: 'POST' }))}
              >
                Verrouiller et jouer
              </button>
            </div>
          ) : (
            <p className="text-sm text-mute">
              Pouvoirs : {openGame.powers.map((power) => `${names.get(power.playerId)?.name} ${power.kind}`).join(' · ') || 'aucun'}
            </p>
          )}
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
                      <PlayerAvatar avatar={player.avatar} photoData={player.photoData} size={48} />
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
                  <label className="mt-2 block text-center text-xs text-mute">
                    Photo session
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (!file) {
                          return
                        }
                        void compressPhoto(file).then((photoData) =>
                          run('photo', () =>
                            mutate(`/api/sessions/${code}/photo`, {
                              method: 'POST',
                              body: JSON.stringify({ playerId: player.id, photoData }),
                            }),
                          ),
                        )
                      }}
                    />
                  </label>
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
                        <PlayerAvatar avatar={player.avatar} photoData={player.photoData} size={20} />
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

      {session.status === 'open' && friends.length > 0 ? (
        <section className="rounded-3xl bg-panel p-4">
          <p className="font-hud text-xs tracking-[0.2em] text-gold">INVITER UN AMI</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {friends.map((row) => (
              <button
                key={row.user.id}
                type="button"
                className="rounded-full bg-dusk px-3 py-2 text-sm"
                onClick={() =>
                  void run('invite', async () => {
                    const response = await fetch(`/api/sessions/${code}/invite`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ friendUserId: row.user.id }),
                    })
                    const data = await response.json()
                    if (!response.ok) {
                      throw new Error(data.error ?? 'Invitation impossible')
                    }
                    setToast(`Invitation envoyée à ${row.user.name}`)
                  })
                }
              >
                {row.user.name}
              </button>
            ))}
          </div>
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
  const pointsMap = openGame
    ? modifiedPoints(openGame.scores, openGame.powers)
    : new Map<string, number>()
  return session.players
    .map((player) => {
      const gameScore = openGame?.scores.find((row) => row.playerId === player.id)
      const gamePoints = pointsMap.get(player.id) ?? (gameScore ? gameScore.kills + gameScore.revives : 0)
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
            <PlayerAvatar avatar={row.player.avatar} photoData={row.player.photoData} size={36} />
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
                  {from ? <PlayerAvatar avatar={from.avatar} photoData={from.photoData} size={22} /> : null}
                  {from?.name ?? '???'}
                  <span className="opacity-50">→</span>
                  {to ? <PlayerAvatar avatar={to.avatar} photoData={to.photoData} size={22} /> : null}
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
