'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Me = {
  user: { id: string; name: string; friendCode: string } | null
  notifications: { id: string; title: string; href: string; read: boolean }[]
}

export function AppChrome() {
  const [me, setMe] = useState<Me>({ user: null, notifications: [] })
  const [open, setOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const response = await fetch('/api/me', { cache: 'no-store' })
      if (!response.ok) {
        return
      }
      setMe(await response.json())
    }
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(timer)
  }, [])

  const unread = me.notifications.filter((row) => !row.read).length

  return (
    <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 pb-2 pt-4">
      <Link href="/" className="font-hud text-[11px] tracking-[0.3em] text-horizon">
        DETTE ROYALE
      </Link>
      <nav className="flex items-center gap-3 text-sm">
        {me.user ? (
          <>
            <div className="relative">
              <button type="button" onClick={() => setOpen((value) => !value)} className="text-gold">
                {unread > 0 ? `${unread} notif` : 'notif'}
              </button>
              {open ? (
                <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl bg-panel p-3 text-sm shadow-xl">
                  {me.notifications.length === 0 ? (
                    <p className="text-mute">Rien pour l’instant</p>
                  ) : (
                    me.notifications.slice(0, 8).map((row) => (
                      <Link key={row.id} href={row.href} className="block py-2" onClick={() => setOpen(false)}>
                        {row.title}
                      </Link>
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
