'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { PlayerAvatar } from '@/components/avatar'

type Message = { id: string; fromMe: boolean; body: string; createdAt: string }

export default function FriendChatPage() {
  const params = useParams<{ code: string }>()
  const [friend, setFriend] = useState<{ name: string; friendCode: string; photoData?: string | null } | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)

  async function load() {
    const response = await fetch(`/api/friends/${params.code}/messages`, { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? 'Conversation introuvable')
      return
    }
    setError('')
    setFriend(data.friend)
    setMessages(data.messages)
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void load()
      }
    }, 3000)
    return () => window.clearInterval(timer)
  }, [params.code])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function send(event: FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || pending) {
      return
    }
    setPending(true)
    setError('')
    try {
      const response = await fetch(`/api/friends/${params.code}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Envoi impossible')
      }
      setDraft('')
      setMessages((current) => [...current, data])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setPending(false)
    }
  }

  if (error && !friend) {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-8">
        <p>{error}</p>
        <Link href="/amis" className="mt-4 inline-block text-horizon underline">
          Retour aux amis
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 py-8">
      <p className="font-hud text-[11px] tracking-[0.35em] text-horizon">MESSAGE</p>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {friend ? <PlayerAvatar avatar="drop" photoData={friend.photoData} size={48} className="shrink-0" /> : null}
          <h1 className="font-display text-5xl">{friend?.name ?? '…'}</h1>
        </div>
        {friend ? (
          <Link href={`/profil/${friend.friendCode}`} className="text-sm text-horizon underline">
            Profil
          </Link>
        ) : null}
      </div>
      <ul className="flex min-h-[40vh] flex-col gap-2">
        {messages.length === 0 ? (
          <li className="rounded-2xl bg-panel px-4 py-3 text-sm text-mute">Aucun message pour l’instant.</li>
        ) : (
          messages.map((row) => (
            <li
              key={row.id}
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                row.fromMe ? 'ml-auto bg-horizon text-dusk' : 'bg-panel'
              }`}
            >
              {row.body}
            </li>
          ))
        )}
        <div ref={bottom} />
      </ul>
      {error ? <p className="text-sm text-kill">{error}</p> : null}
      <form onSubmit={(event) => void send(event)} className="flex gap-2">
        <input
          value={draft}
          maxLength={500}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Écris un message"
          className="flex-1 rounded-full bg-panel px-4 py-3"
        />
        <button
          disabled={pending || !draft.trim()}
          className="rounded-full bg-horizon px-4 font-semibold text-dusk disabled:opacity-50"
        >
          {pending ? '…' : 'Envoyer'}
        </button>
      </form>
    </main>
  )
}
