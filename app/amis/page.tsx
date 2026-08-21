'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'

type FriendRow = {
  friendshipId: string
  status: string
  incoming: boolean
  user: { id: string; name: string; friendCode: string }
}

export default function AmisPage() {
  const [code, setCode] = useState('')
  const [friends, setFriends] = useState<FriendRow[]>([])
  const [me, setMe] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const response = await fetch('/api/friends')
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? 'Connecte-toi')
      return
    }
    setFriends(data.friends)
    setMe(data.me.friendCode)
  }

  useEffect(() => {
    void load()
  }, [])

  async function add(event: FormEvent) {
    event.preventDefault()
    const response = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? 'Impossible')
      return
    }
    setError('')
    setCode('')
    setFriends(data.friends)
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-8">
      <h1 className="font-display text-5xl">AMIS</h1>
      {me ? <p className="font-hud tracking-[0.2em] text-gold">TON ID {me}</p> : null}
      <form onSubmit={add} className="flex gap-2">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="ID pote"
          className="flex-1 rounded-full bg-panel px-4 py-3 font-hud tracking-widest"
        />
        <button className="rounded-full bg-horizon px-4 font-semibold text-dusk">Ajouter</button>
      </form>
      {error ? <p className="text-kill">{error}</p> : null}
      <ul className="flex flex-col gap-2">
        {friends.map((row) => (
          <li key={row.friendshipId}>
            {row.status === 'accepted' ? (
              <Link
                href={`/profil/${row.user.friendCode}`}
                className="flex items-center justify-between rounded-2xl bg-panel px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{row.user.name}</p>
                  <p className="font-hud text-xs text-mute">{row.user.friendCode}</p>
                </div>
                <span className="text-sm text-mute">Ami</span>
              </Link>
            ) : (
              <div className="flex items-center justify-between rounded-2xl bg-panel px-4 py-3">
                <div>
                  <p className="font-semibold">{row.user.name}</p>
                  <p className="font-hud text-xs text-mute">{row.user.friendCode}</p>
                </div>
                {row.incoming ? (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-horizon px-3 py-1 text-sm text-dusk"
                      onClick={async () => {
                        const response = await fetch(`/api/friends/${row.friendshipId}/accept`, { method: 'POST' })
                        const data = await response.json()
                        if (response.ok) {
                          setFriends(data.friends)
                        }
                      }}
                    >
                      Accepter
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-dusk px-3 py-1 text-sm text-kill"
                      onClick={async () => {
                        const response = await fetch(`/api/friends/${row.friendshipId}`, { method: 'DELETE' })
                        if (response.ok) {
                          setFriends((current) => current.filter((item) => item.friendshipId !== row.friendshipId))
                        }
                      }}
                    >
                      Refuser
                    </button>
                  </div>
                ) : (
                  <span className="text-sm text-mute">En attente</span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}
