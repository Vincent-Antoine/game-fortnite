'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AvatarPicker, PlayerAvatar } from '@/components/avatar'
import { PhotoPicker } from '@/components/photo-picker'
import { allScoresConfirmed, SESSION_PING_PRESETS } from '@/lib/chat'
import { formatCents } from '@/lib/money'
import { isPlayerLive } from '@/lib/presence'
import { modifiedPoints, sessionPoints, type PowerKind, type PowerUse } from '@/lib/scoring'
import { mergeSessionDto } from '@/lib/session-sync'
import type { SessionDTO } from '@/lib/types'
import { BusyLabel, Spinner } from '@/components/spinner'

type Props = { code: string }

type PlayerRef = SessionDTO['players'][number]

export function SessionView({ code }: Props) {
  const [session, setSession] = useState<SessionDTO | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [meUser, setMeUser] = useState<{ name: string; photoData: string | null } | null>(null)
  const [joinName, setJoinName] = useState('')
  const [joinAvatar, setJoinAvatar] = useState('drop')
  const [joinPhoto, setJoinPhoto] = useState<string | null>(null)
  const [pending, setPending] = useState('')
  const [savingPlayers, setSavingPlayers] = useState<Record<string, boolean>>({})
  const [newName, setNewName] = useState('')
  const [newAvatar, setNewAvatar] = useState('drop')
  const [newPhoto, setNewPhoto] = useState<string | null>(null)
  const [friends, setFriends] = useState<{ user: { id: string; name: string }; status: string }[]>([])
  const skipPoll = useRef(0)
  const scoreTimers = useRef(new Map<string, number>())
  const editingPlayers = useRef(new Set<string>())
  const pendingScores = useRef(new Set<string>())
  const scoreSeq = useRef(new Map<string, number>())
  const writeQueue = useRef(Promise.resolve())
  const sessionRef = useRef<SessionDTO | null>(null)
  const scrolledToHistory = useRef(false)
  const [showRules, setShowRules] = useState(false)
  sessionRef.current = session

  const heldPlayers = useCallback(() => new Set([...editingPlayers.current, ...pendingScores.current]), [])

  const applyRemote = useCallback((remote: SessionDTO) => {
    setSession(mergeSessionDto(sessionRef.current, remote, heldPlayers()))
  }, [heldPlayers])

  const enqueue = useCallback(<T,>(job: () => Promise<T>) => {
    let result!: T
    const next = writeQueue.current.then(
      async () => {
        result = await job()
      },
      async () => {
        result = await job()
      },
    )
    writeQueue.current = next.then(
      () => undefined,
      () => undefined,
    )
    return next.then(() => result)
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
    applyRemote(data)
  }, [applyRemote, code])

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
          if (data.user.photoData) {
            setJoinPhoto((current) => current ?? data.user.photoData)
          }
        }
      })
      .catch(() => undefined)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    if (!session?.youPlayerId) {
      return
    }
    void fetch(`/api/sessions/${code}/presence`, { method: 'POST' })
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void fetch(`/api/sessions/${code}/presence`, { method: 'POST' })
      }
    }, 8000)
    return () => window.clearInterval(timer)
  }, [code, session?.youPlayerId])

  useEffect(() => {
    if (!session?.youPlayerId) {
      return
    }
    try {
      if (!window.localStorage.getItem(`dr_rules_${session.code}`)) {
        setShowRules(true)
      }
    } catch {
      setShowRules(true)
    }
  }, [session?.youPlayerId, session?.code])

  useEffect(() => {
    if (!session || scrolledToHistory.current || window.location.hash !== '#historique') {
      return
    }
    scrolledToHistory.current = true
    window.requestAnimationFrame(() => {
      document.getElementById('historique')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [session])

  const names = useMemo(() => {
    const map = new Map<string, PlayerRef>()
    session?.players.forEach((player) => map.set(player.id, player))
    return map
  }, [session])

  const openGame = session?.games.find((game) => game.status === 'open')
  const closedGames = session?.games.filter((game) => game.status === 'closed') ?? []
  const youAreHost = Boolean(session?.players.some((player) => player.id === session.youPlayerId && player.isHost))
  const board = useMemo(() => (session ? liveBoard(session) : []), [session])

  async function mutate(path: string, init?: RequestInit) {
    setError('')
    return enqueue(async () => {
      const response = await fetch(path, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Action impossible')
      }
      skipPoll.current = Date.now() + 800
      applyRemote(data)
      return data as SessionDTO
    })
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

  function setSaving(playerId: string, value: boolean) {
    setSavingPlayers((current) => {
      if (Boolean(current[playerId]) === value) {
        return current
      }
      return { ...current, [playerId]: value }
    })
  }

  function patchLocalScore(playerId: string, field: 'kills' | 'revives', value: number) {
    const current = sessionRef.current
    const game = current?.games.find((row) => row.status === 'open')
    if (!current || !game) {
      return null
    }
    const existing = game.scores.find((row) => row.playerId === playerId) ?? {
      playerId,
      kills: 0,
      revives: 0,
      confirmedAt: null,
    }
    if (existing.confirmedAt) {
      return null
    }
    const nextScore = { ...existing, [field]: value }
    const scores = game.scores.some((row) => row.playerId === playerId)
      ? game.scores.map((row) => (row.playerId === playerId ? nextScore : row))
      : [...game.scores, nextScore]
    const next = {
      ...current,
      games: current.games.map((row) => (row.id === game.id ? { ...row, scores } : row)),
    }
    setSession(next)
    return nextScore
  }

  function flushScore(playerId: string) {
    const seq = (scoreSeq.current.get(playerId) ?? 0) + 1
    scoreSeq.current.set(playerId, seq)
    pendingScores.current.add(playerId)
    setSaving(playerId, true)
    skipPoll.current = Date.now() + 2500
    void enqueue(async () => {
      const game = sessionRef.current?.games.find((row) => row.status === 'open')
      const saved = game?.scores.find((row) => row.playerId === playerId)
      if (!game || !saved) {
        pendingScores.current.delete(playerId)
        setSaving(playerId, false)
        return
      }
      try {
        const response = await fetch(`/api/sessions/${code}/games/${game.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scores: [saved] }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error ?? 'Score impossible')
        }
        if (scoreSeq.current.get(playerId) === seq) {
          pendingScores.current.delete(playerId)
          setSaving(playerId, false)
        }
        applyRemote(data)
      } catch (err) {
        if (scoreSeq.current.get(playerId) === seq) {
          pendingScores.current.delete(playerId)
          setSaving(playerId, false)
        }
        setError(err instanceof Error ? err.message : 'Erreur')
      }
    })
  }

  function commitScore(playerId: string, field: 'kills' | 'revives', raw: string, immediate = false) {
    const parsed = Number.parseInt(raw, 10)
    const value = Number.isFinite(parsed) ? Math.max(0, Math.min(99, parsed)) : 0
    if (!patchLocalScore(playerId, field, value)) {
      return
    }
    pendingScores.current.add(playerId)
    setSaving(playerId, true)
    skipPoll.current = Date.now() + 2500
    const previous = scoreTimers.current.get(playerId)
    if (previous) {
      window.clearTimeout(previous)
    }
    if (immediate) {
      flushScore(playerId)
      return
    }
    scoreTimers.current.set(
      playerId,
      window.setTimeout(() => flushScore(playerId), 450) as unknown as number,
    )
  }

  function nudgeScore(playerId: string, field: 'kills' | 'revives', delta: number) {
    const game = sessionRef.current?.games.find((row) => row.status === 'open')
    const current = game?.scores.find((row) => row.playerId === playerId)
    if (!game || current?.confirmedAt) {
      return
    }
    const next = Math.max(0, Math.min(99, (current?.[field] ?? 0) + delta))
    commitScore(playerId, field, String(next), true)
  }

  function flushPendingScores() {
    const ids = new Set([...pendingScores.current, ...scoreTimers.current.keys()])
    for (const playerId of ids) {
      const timer = scoreTimers.current.get(playerId)
      if (timer) {
        window.clearTimeout(timer)
        scoreTimers.current.delete(playerId)
      }
      flushScore(playerId)
    }
  }

  function setFirstKill(playerId: string) {
    if (!session || !openGame) {
      return
    }
    const firstKillPlayerId = openGame.firstKillPlayerId === playerId ? null : playerId
    setSession({
      ...session,
      games: session.games.map((game) =>
        game.id === openGame.id ? { ...game, firstKillPlayerId } : game,
      ),
    })
    void run('fk', () =>
      mutate(`/api/sessions/${code}/games/${openGame.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ firstKillPlayerId }),
      }),
    )
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
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col gap-6 px-4 pb-36 pt-6">
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
      {showRules ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/55 p-4 sm:place-items-center">
          <article className="w-full max-w-md rounded-3xl bg-panel p-5">
            <p className="font-hud text-[11px] tracking-[0.3em] text-gold">RÈGLES</p>
            <h2 className="mt-1 font-display text-4xl">SOIRÉE</h2>
            <ul className="mt-4 flex flex-col gap-2 text-sm leading-6">
              <li>Mise {formatCents(session.stakeCents)} par point du gagnant.</li>
              <li>Le dernier paie les points du premier. Les milieux ne paient rien.</li>
              <li>À 2, le perdant paie le gagnant.</li>
              <li>First kill départage. Sinon la dette se partage.</li>
              <li>Pouvoirs : 1 par game, chaque pouvoir 1 fois dans la soirée. Reclique pour annuler.</li>
            </ul>
            <button
              type="button"
              className="mt-5 w-full rounded-full bg-horizon py-3 font-semibold text-dusk"
              onClick={() => {
                try {
                  window.localStorage.setItem(`dr_rules_${session.code}`, '1')
                } catch {
                  undefined
                }
                setShowRules(false)
              }}
            >
              C’est noté
            </button>
          </article>
        </div>
      ) : null}

      {!session.youPlayerId && session.status === 'open' ? (
        <section className="rounded-3xl bg-horizon p-5 text-dusk">
          <p className="font-display text-3xl">REJOINS LA SESSION</p>
          <p className="mt-1 text-sm opacity-80">Tu vois la soirée, mais tu n’es pas encore dans le squad.</p>
          <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-dusk p-3 text-ink">
            <AvatarPicker value={joinAvatar} onChange={setJoinAvatar} />
            <PhotoPicker value={joinPhoto} onChange={setJoinPhoto} />
          </div>
          {meUser ? (
            <button
              type="button"
              className="mt-4 w-full rounded-full bg-dusk py-3 font-semibold text-ink"
              disabled={pending !== ''}
              onClick={() =>
                void run('join', async () => {
                  const response = await fetch(`/api/sessions/${code}/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: meUser.name, avatar: joinAvatar, photoData: joinPhoto }),
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
              <BusyLabel busy={pending === 'join'}>Rejoindre avec {meUser.name}</BusyLabel>
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
                    body: JSON.stringify({ name: joinName, avatar: joinAvatar, photoData: joinPhoto }),
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
              <input
                required
                value={joinName}
                onChange={(event) => setJoinName(event.target.value)}
                placeholder="Ton pseudo"
                className="rounded-full bg-dusk px-4 py-3 text-ink outline-none"
              />
              <button disabled={pending !== ''} className="rounded-full bg-dusk py-3 font-semibold text-ink disabled:opacity-60">
                <BusyLabel busy={pending === 'join'}>Rejoindre</BusyLabel>
              </button>
            </form>
          )}
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
              <p className="font-hud text-xs tracking-[0.2em] text-gold">POUVOIRS · 1 PAR GAME</p>
              <p className="mt-1 text-sm text-mute">
                Tu choisis le tien au début de chaque game. Déjà utilisé ce soir = plus dispo. Reclique pour
                annuler.
              </p>
              {(() => {
                const you = session.players.find((player) => player.id === session.youPlayerId)
                if (!you) {
                  return <p className="mt-3 text-sm text-mute">Rejoins la session pour choisir ton pouvoir.</p>
                }
                return (
                  <PowerPicker
                    you={you}
                    others={session.players.filter((player) => player.id !== you.id)}
                    selected={openGame.powers.find((power) => power.playerId === you.id) ?? null}
                    disabled={pending !== ''}
                    busy={pending === 'power'}
                    onPick={(kind, targetPlayerId) =>
                      void run('power', () =>
                        mutate(`/api/sessions/${code}/games/${openGame.id}/powers`, {
                          method: 'POST',
                          body: JSON.stringify({ kind, targetPlayerId }),
                        }),
                      )
                    }
                  />
                )
              })()}
              {openGame.powers.filter((power) => power.playerId !== session.youPlayerId).length > 0 ? (
                <p className="mt-3 text-sm text-mute">
                  Les autres :{' '}
                  {openGame.powers
                    .filter((power) => power.playerId !== session.youPlayerId)
                    .map((power) => `${names.get(power.playerId)?.name} ${powerLabel(power.kind, names.get(power.targetPlayerId ?? '')?.name)}`)
                    .join(' · ')}
                </p>
              ) : null}
              <button
                type="button"
                className="mt-4 w-full rounded-full bg-gold py-3 font-semibold text-dusk disabled:opacity-60"
                disabled={pending !== ''}
                onClick={() =>
                  void run('lock', () => {
                    flushPendingScores()
                    return mutate(`/api/sessions/${code}/games/${openGame.id}/powers/lock`, { method: 'POST' })
                  })
                }
              >
                <BusyLabel busy={pending === 'lock'}>Verrouiller et jouer</BusyLabel>
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
              confirmedAt: null,
            }
            const points = modifiedPoints(openGame.scores, openGame.powers).get(player.id) ?? score.kills + score.revives
            const isFirst = openGame.firstKillPlayerId === player.id
            const mine = session.youPlayerId === player.id
            const confirmed = Boolean(score.confirmedAt)
            return (
              <article
                key={player.id}
                className="overflow-hidden rounded-3xl bg-panel"
                style={{ boxShadow: `inset 6px 0 0 ${player.color}` }}
              >
                <div className="px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <LiveAvatar player={player} />
                      <div>
                        <p className="text-lg font-semibold">
                          {player.name}
                          {mine ? ' · toi' : ''}
                        </p>
                        <p className="font-hud text-xs tracking-widest text-mute">{points} PTS</p>
                      </div>
                    </div>
                    <p className="font-display text-5xl leading-none">{points}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <ScoreField
                      label="Kills"
                      value={score.kills}
                      accent="kill"
                      disabled={confirmed}
                      onFocus={() => editingPlayers.current.add(player.id)}
                      onBlur={() => {
                        editingPlayers.current.delete(player.id)
                      }}
                      onCommit={(raw) => commitScore(player.id, 'kills', raw)}
                      onFlush={(raw) => commitScore(player.id, 'kills', raw, true)}
                      onNudge={(delta) => nudgeScore(player.id, 'kills', delta)}
                      busy={Boolean(savingPlayers[player.id])}
                    />
                    <ScoreField
                      label="Réas"
                      value={score.revives}
                      accent="rez"
                      disabled={confirmed}
                      onFocus={() => editingPlayers.current.add(player.id)}
                      onBlur={() => {
                        editingPlayers.current.delete(player.id)
                      }}
                      onCommit={(raw) => commitScore(player.id, 'revives', raw)}
                      onFlush={(raw) => commitScore(player.id, 'revives', raw, true)}
                      onNudge={(delta) => nudgeScore(player.id, 'revives', delta)}
                      busy={Boolean(savingPlayers[player.id])}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFirstKill(player.id)}
                    disabled={pending !== ''}
                    className={`mt-3 w-full rounded-full py-2 font-hud text-xs tracking-[0.2em] disabled:opacity-60 ${isFirst ? 'bg-gold text-dusk' : 'bg-dusk text-mute'}`}
                  >
                    <BusyLabel busy={pending === 'fk'}>
                      {isFirst ? 'FIRST KILL' : 'MARQUER FIRST KILL'}
                    </BusyLabel>
                  </button>
                  {mine && !confirmed ? (
                    <button
                      type="button"
                      disabled={pending !== ''}
                      onClick={() =>
                        void run('confirm', () => {
                          flushPendingScores()
                          return mutate(`/api/sessions/${code}/games/${openGame.id}/confirm`, { method: 'POST' })
                        })
                      }
                      className="mt-3 w-full rounded-full bg-rez py-3 font-semibold text-dusk disabled:opacity-50"
                    >
                      <BusyLabel busy={pending === 'confirm'}>Confirmer mes scores</BusyLabel>
                    </button>
                  ) : mine && confirmed ? (
                    <button
                      type="button"
                      disabled={pending !== ''}
                      onClick={() =>
                        void run('unconfirm', () =>
                          mutate(`/api/sessions/${code}/games/${openGame.id}/confirm`, { method: 'DELETE' }),
                        )
                      }
                      className="mt-3 w-full text-sm text-mute underline disabled:opacity-50"
                    >
                      <BusyLabel busy={pending === 'unconfirm'}>Modifier mes scores</BusyLabel>
                    </button>
                  ) : (
                    <p className={`mt-3 text-center font-hud text-xs tracking-[0.2em] ${confirmed ? 'text-rez' : 'text-mute'}`}>
                      {confirmed ? 'CONFIRMÉ' : 'EN ATTENTE'}
                    </p>
                  )}
                  {youAreHost && session.status === 'open' ? (
                    <HostPlayerActions
                      name={player.name}
                      busy={pending === 'rename' || pending === 'kick'}
                      canKick={!player.isHost && player.id !== session.youPlayerId}
                      onRename={(name) =>
                        void run('rename', () =>
                          mutate(`/api/sessions/${code}/players/${player.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ name }),
                          }),
                        )
                      }
                      onKick={() =>
                        void run('kick', () => mutate(`/api/sessions/${code}/players/${player.id}`, { method: 'DELETE' }))
                      }
                    />
                  ) : null}
                </div>
              </article>
            )
          })}
          <button
            disabled={pending !== '' || session.status !== 'open' || !allScoresConfirmed(openGame.scores)}
            onClick={() =>
              void run('close-game', () => {
                flushPendingScores()
                return mutate(`/api/sessions/${code}/games/${openGame.id}/close`, { method: 'POST' })
              })
            }
            className="rounded-full bg-horizon py-4 text-lg font-semibold text-dusk disabled:opacity-50"
          >
            <BusyLabel busy={pending === 'close-game'}>
              {pending === 'close-game'
                ? 'Calcul'
                : !allScoresConfirmed(openGame.scores)
                  ? `Encore ${session.players
                      .filter((player) => !openGame.scores.find((row) => row.playerId === player.id)?.confirmedAt)
                      .map((player) => player.name)
                      .join(', ')}`
                  : 'Clôturer la game'}
            </BusyLabel>
          </button>
        </section>
      ) : session.status === 'open' ? (
        <button
          disabled={pending !== '' || session.players.length < 2}
          onClick={() => void run('new-game', () => mutate(`/api/sessions/${code}/games`, { method: 'POST' }))}
          className="rounded-full bg-horizon py-4 text-lg font-semibold text-dusk disabled:opacity-50"
        >
          <BusyLabel busy={pending === 'new-game'}>
            {session.players.length < 2 ? 'Ajoute un 2e joueur' : 'Ouvrir une game'}
          </BusyLabel>
        </button>
      ) : null}

      {session.youPlayerId && session.status === 'open' ? (
        <PingBar
          pings={session.pings ?? []}
          names={names}
          disabled={pending !== ''}
          sending={pending === 'ping'}
          onSend={(payload) =>
            void run('ping', () =>
              mutate(`/api/sessions/${code}/pings`, {
                method: 'POST',
                body: JSON.stringify(payload),
              }),
            )
          }
        />
      ) : null}

      <div id="historique" className="flex scroll-mt-4 flex-col gap-4">
        <Ticket session={session} names={names} />

        <section>
          <h3 className="font-hud text-xs tracking-[0.25em] text-mute">HISTORIQUE DES GAMES</h3>
          {closedGames.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-panel px-4 py-3 text-sm text-mute">
              Aucune game clôturée pour l’instant.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {closedGames.map((game) => {
                const firstKill = game.firstKillPlayerId ? names.get(game.firstKillPlayerId) : null
                return (
                  <li key={game.id} className="rounded-2xl bg-panel/80 px-4 py-3 text-sm">
                    <p className="font-semibold">
                      Game {game.index}
                      {firstKill ? <span className="font-normal text-mute"> · FK {firstKill.name}</span> : null}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {session.players.map((player) => {
                        const score = game.scores.find((row) => row.playerId === player.id)
                        const points = modifiedPoints(game.scores, game.powers).get(player.id) ?? 0
                        return (
                          <span key={player.id} className="flex items-center gap-1.5">
                            <PlayerAvatar avatar={player.avatar} photoData={player.photoData} size={20} />
                            {player.name} {points}
                          </span>
                        )
                      })}
                    </div>
                    {game.powers.length > 0 ? (
                      <p className="mt-2 text-xs text-gold">
                        {game.powers
                          .map((power) => {
                            const who = names.get(power.playerId)?.name ?? '?'
                            if (power.kind === 'double') {
                              return `${who} x2`
                            }
                            if (power.kind === 'shield') {
                              return `${who} bouclier`
                            }
                            return `${who} /2 ${names.get(power.targetPlayerId ?? '')?.name ?? '?'}`
                          })
                          .join(' · ')}
                      </p>
                    ) : null}
                    {game.transfers.length > 0 ? (
                      <ul className="mt-2 flex flex-col gap-1 text-mute">
                        {game.transfers.map((row) => (
                          <li key={`${game.id}-${row.fromPlayerId}-${row.toPlayerId}`}>
                            {names.get(row.fromPlayerId)?.name ?? '?'} → {names.get(row.toPlayerId)?.name ?? '?'}{' '}
                            {formatCents(row.amountCents)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-mute">Personne ne paie sur cette game.</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {session.status === 'open' ? (
        <section className="rounded-3xl bg-panel p-4">
          <p className="font-hud text-xs tracking-[0.2em] text-gold">LIEN DE SESSION</p>
          <button
            type="button"
            className="mt-2 text-sm text-horizon underline"
            onClick={() => {
              const url = `${window.location.origin}/session/${code}`
              void navigator.clipboard.writeText(url).then(() => setToast('Lien de session copié'))
            }}
          >
            Copier le lien (iMessage)
          </button>
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
                className="rounded-full bg-dusk px-3 py-2 text-sm disabled:opacity-60"
                disabled={pending !== ''}
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
                <BusyLabel busy={pending === 'invite'}>{row.user.name}</BusyLabel>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {session.status === 'open' && youAreHost && !openGame ? (
        <ul className="flex flex-col gap-2">
          {session.players.map((player) => (
            <li key={player.id} className="flex items-center justify-between gap-2 rounded-2xl bg-panel px-4 py-3">
              <p>
                {player.name}
                {player.isHost ? ' · hôte' : ''}
              </p>
              <HostPlayerActions
                name={player.name}
                busy={pending === 'rename' || pending === 'kick'}
                canKick={!player.isHost && player.id !== session.youPlayerId}
                onRename={(name) =>
                  void run('rename', () =>
                    mutate(`/api/sessions/${code}/players/${player.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ name }),
                    }),
                  )
                }
                onKick={() =>
                  void run('kick', () => mutate(`/api/sessions/${code}/players/${player.id}`, { method: 'DELETE' }))
                }
              />
            </li>
          ))}
        </ul>
      ) : null}

      {session.status === 'open' ? (
        <form
          className="flex flex-col gap-3 rounded-3xl bg-panel p-4"
          onSubmit={(event) => {
            event.preventDefault()
            void run('add', async () => {
              await mutate(`/api/sessions/${code}/players`, {
                method: 'POST',
                body: JSON.stringify({ name: newName, avatar: newAvatar, photoData: newPhoto }),
              })
              setNewName('')
              setNewPhoto(null)
            })
          }}
        >
          <span className="font-hud text-xs tracking-[0.2em] text-mute">AJOUTER UN POTE</span>
          <AvatarPicker value={newAvatar} onChange={setNewAvatar} />
          <PhotoPicker value={newPhoto} onChange={setNewPhoto} />
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Pseudo"
              maxLength={20}
              className="flex-1 rounded-full border border-white/10 bg-dusk px-4 py-3 outline-none"
            />
            <button disabled={pending !== ''} className="rounded-full bg-horizon px-4 font-semibold text-dusk disabled:opacity-60">
              <BusyLabel busy={pending === 'add'}>OK</BusyLabel>
            </button>
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
          <BusyLabel busy={pending === 'close-session'}>Clôturer la session</BusyLabel>
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
  const nightMap = sessionPoints(session.games)
  return session.players
    .map((player) => {
      const gameScore = openGame?.scores.find((row) => row.playerId === player.id)
      const gamePoints = pointsMap.get(player.id) ?? (gameScore ? gameScore.kills + gameScore.revives : 0)
      const nightPoints = nightMap.get(player.id) ?? 0
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

function powerLabel(kind: string, targetName?: string) {
  if (kind === 'double') {
    return 'x2'
  }
  if (kind === 'shield') {
    return 'bouclier'
  }
  if (kind === 'halve') {
    return targetName ? `/2 ${targetName}` : '/2'
  }
  return kind
}

function PowerPicker({
  you,
  others,
  selected,
  disabled,
  busy,
  onPick,
}: {
  you: PlayerRef
  others: PlayerRef[]
  selected: PowerUse | null
  disabled: boolean
  busy: boolean
  onPick: (kind: PowerKind, targetPlayerId?: string | null) => void
}) {
  function chip(active: boolean, used: boolean) {
    if (used) {
      return 'rounded-full bg-dusk px-3 py-1 text-xs opacity-30'
    }
    if (active) {
      return 'rounded-full bg-gold px-3 py-1 text-xs font-semibold text-dusk'
    }
    return 'rounded-full bg-dusk px-3 py-1 text-xs'
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <span className="w-full text-sm font-semibold">Ton pouvoir</span>
      <button
        type="button"
        disabled={disabled || you.usedPowers.double}
        onClick={() => onPick('double')}
        className={`${chip(selected?.kind === 'double', you.usedPowers.double)} inline-flex items-center gap-1`}
      >
        {busy ? <Spinner className="h-3 w-3" /> : 'x2'}
      </button>
      <button
        type="button"
        disabled={disabled || you.usedPowers.shield}
        onClick={() => onPick('shield')}
        className={`${chip(selected?.kind === 'shield', you.usedPowers.shield)} inline-flex items-center gap-1`}
      >
        {busy ? <Spinner className="h-3 w-3" /> : null}
        Bouclier
      </button>
      {others.map((target) => (
        <button
          key={target.id}
          type="button"
          disabled={disabled || you.usedPowers.halve}
          onClick={() => onPick('halve', target.id)}
          className={`${chip(selected?.kind === 'halve' && selected.targetPlayerId === target.id, you.usedPowers.halve)} inline-flex items-center gap-1`}
        >
          {busy ? <Spinner className="h-3 w-3" /> : null}
          /2 {target.name}
        </button>
      ))}
    </div>
  )
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
            <LiveAvatar player={row.player} size={36} />
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

function LiveAvatar({ player, size = 48 }: { player: PlayerRef; size?: number }) {
  const live = isPlayerLive(player.lastSeenAt)
  return (
    <span className="relative inline-block shrink-0">
      <PlayerAvatar avatar={player.avatar} photoData={player.photoData} size={size} />
      {live ? (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-rez ring-2 ring-panel" />
      ) : null}
    </span>
  )
}

function HostPlayerActions({
  name,
  canKick,
  busy,
  onRename,
  onKick,
}: {
  name: string
  canKick: boolean
  busy?: boolean
  onRename: (name: string) => void
  onKick: () => void
}) {
  return (
    <div className="mt-2 flex justify-end gap-3">
      <button
        type="button"
        className="text-xs text-horizon underline"
        onClick={() => {
          const next = window.prompt('Nouveau pseudo', name)
          if (next && next.trim() && next.trim() !== name) {
            onRename(next)
          }
        }}
      >
        <BusyLabel busy={Boolean(busy)}>Renommer</BusyLabel>
      </button>
      {canKick ? (
        <button
          type="button"
          className="text-xs text-kill underline"
          onClick={() => {
            if (window.confirm(`Retirer ${name} de la session ?`)) {
              onKick()
            }
          }}
        >
          <BusyLabel busy={Boolean(busy)}>Retirer</BusyLabel>
        </button>
      ) : null}
    </div>
  )
}

function ScoreField({
  label,
  value,
  accent,
  disabled,
  onFocus,
  onBlur,
  onCommit,
  onFlush,
  onNudge,
  busy,
}: {
  label: string
  value: number
  accent: 'kill' | 'rez'
  disabled?: boolean
  onFocus: () => void
  onBlur: () => void
  onCommit: (raw: string) => void
  onFlush: (raw: string) => void
  onNudge: (delta: number) => void
  busy?: boolean
}) {
  const [text, setText] = useState(String(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) {
      setText(String(value))
    }
  }, [value, focused])
  const color = accent === 'kill' ? 'text-kill' : 'text-rez'
  return (
    <label className={`rounded-2xl bg-dusk px-3 py-3 ${disabled ? 'opacity-50' : ''}`}>
      <p className={`flex items-center gap-1.5 font-hud text-[10px] tracking-[0.2em] ${color}`}>
        {label.toUpperCase()}
        {busy ? <Spinner className="h-3 w-3" /> : null}
      </p>
      <div className="mt-1 flex items-center gap-1">
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onNudge(-1)}
          className="h-10 w-10 shrink-0 rounded-full bg-panel text-xl text-mute"
        >
          −
        </button>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          readOnly={disabled}
          value={focused ? text : String(value)}
          onFocus={() => {
            if (disabled) {
              return
            }
            setFocused(true)
            setText(String(value))
            onFocus()
          }}
          onBlur={() => {
            if (disabled) {
              return
            }
            setFocused(false)
            onFlush(text === '' ? '0' : text)
            onBlur()
          }}
          onChange={(event) => {
            if (disabled) {
              return
            }
            const next = event.target.value.replace(/\D/g, '').slice(0, 2)
            setText(next)
            onCommit(next === '' ? '0' : next)
          }}
          className="w-full bg-transparent text-center font-display text-3xl outline-none"
        />
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onNudge(1)}
          className="h-10 w-10 shrink-0 rounded-full bg-panel text-xl text-mute"
        >
          +
        </button>
      </div>
    </label>
  )
}

function PingBar({
  pings,
  names,
  disabled,
  sending,
  onSend,
}: {
  pings: SessionDTO['pings']
  names: Map<string, PlayerRef>
  disabled: boolean
  sending: boolean
  onSend: (payload: { preset?: string; body?: string }) => void
}) {
  const [draft, setDraft] = useState('')
  return (
    <section className="rounded-3xl bg-panel p-4">
      <p className="font-hud text-xs tracking-[0.2em] text-gold">PING SQUAD</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(SESSION_PING_PRESETS) as Array<keyof typeof SESSION_PING_PRESETS>).map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            onClick={() => onSend({ preset })}
            className="rounded-full bg-dusk px-3 py-2 text-sm disabled:opacity-50"
          >
            {SESSION_PING_PRESETS[preset]}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const body = draft.trim()
          if (!body) {
            return
          }
          onSend({ body })
          setDraft('')
        }}
      >
        <input
          value={draft}
          maxLength={120}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message court"
          className="flex-1 rounded-full bg-dusk px-4 py-2 text-sm"
        />
        <button
          disabled={disabled || !draft.trim()}
          className="rounded-full bg-horizon px-4 text-sm font-semibold text-dusk disabled:opacity-50"
        >
          <BusyLabel busy={sending}>Ping</BusyLabel>
        </button>
      </form>
      {pings.length === 0 ? (
        <p className="mt-3 text-sm text-mute">Aucun ping pour l’instant.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {pings.map((row) => (
            <li key={row.id} className="text-sm">
              <span className="text-mute">{names.get(row.fromPlayerId)?.name ?? 'Pote'} · </span>
              {row.body}
            </li>
          ))}
        </ul>
      )}
    </section>
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
