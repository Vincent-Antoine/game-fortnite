'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type Note = { id: string; title: string; href: string; read: boolean; type: string }

type Me = {
  user: { id: string; name: string; friendCode: string } | null
  notifications: Note[]
}

export function AppChrome() {
  const router = useRouter()
  const [me, setMe] = useState<Me>({ user: null, notifications: [] })
  const [open, setOpen] = useState(false)

  async function load() {
    const response = await fetch('/api/me', { cache: 'no-store' })
    if (!response.ok) {
      return
    }
    setMe(await response.json())
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 4000)
    return () => window.clearInterval(timer)
  }, [])

  const unread = me.notifications.length

  async function removeNote(id: string) {
    setMe((current) => ({
      ...current,
      notifications: current.notifications.filter((row) => row.id !== id),
    }))
    await fetch('/api/me/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  async function openNote(row: Note) {
    await removeNote(row.id)
    setOpen(false)
    router.push(row.href)
  }

  return (
    <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 pb-2 pt-4">
      <Link href="/" className="font-hud text-[11px] tracking-[0.3em] text-horizon">
        DETTE ROYALE
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        {me.user ? (
          <>
            <div className="relative">
              <button
                type="button"
                aria-label="Notifications"
                onClick={() => setOpen((value) => !value)}
                className="relative grid h-10 w-10 place-items-center rounded-full bg-panel text-ink"
              >
                <BellIcon />
                {unread > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-horizon px-1 font-hud text-[10px] text-dusk">
                    {unread > 9 ? '9+' : unread}
                  </span>
                ) : null}
              </button>
              {open ? (
                <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-2xl bg-panel text-sm shadow-2xl ring-1 ring-white/10">
                  <p className="border-b border-white/10 px-4 py-2 font-hud text-[10px] tracking-[0.25em] text-mute">
                    NOTIFICATIONS
                  </p>
                  {me.notifications.length === 0 ? (
                    <p className="px-4 py-6 text-center text-mute">Boîte vide</p>
                  ) : (
                    me.notifications.slice(0, 10).map((row) => (
                      <div key={row.id} className="flex items-stretch border-b border-white/5 last:border-0">
                        <button
                          type="button"
                          onClick={() => void openNote(row)}
                          className="flex-1 px-4 py-3 text-left hover:bg-dusk/50"
                        >
                          {row.title}
                        </button>
                        <button
                          type="button"
                          aria-label="Supprimer"
                          onClick={() => void removeNote(row.id)}
                          className="px-3 text-mute hover:text-kill"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            <Link href="/amis">Amis</Link>
            <Link href="/profil">{me.user.name}</Link>
          </>
        ) : (
          <>
            <Link href="/connexion">Connexion</Link>
            <Link href="/inscription" className="text-horizon">
              Inscription
            </Link>
          </>
        )}
      </nav>
    </header>
  )
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
