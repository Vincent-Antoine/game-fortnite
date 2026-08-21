'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AddFriendLinkPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  useEffect(() => {
    const code = String(params.code ?? '').toUpperCase()
    void fetch('/api/me', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!data.user) {
          router.replace(`/inscription?ami=${encodeURIComponent(code)}`)
          return
        }
        const add = await fetch('/api/friends', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        const payload = await add.json()
        if (add.status === 409) {
          router.replace('/amis')
          return
        }
        if (!add.ok) {
          setError(payload.error ?? 'Ajout impossible')
          return
        }
        setDone('Demande envoyée')
        window.setTimeout(() => router.replace('/amis'), 800)
      })
      .catch(() => setError('Erreur'))
  }, [params.code, router])

  return (
    <main className="mx-auto w-full max-w-md px-5 py-8">
      <p>{error || done || 'Ajout en cours…'}</p>
      {error ? (
        <Link href="/amis" className="mt-4 inline-block text-horizon underline">
          Retour aux amis
        </Link>
      ) : null}
    </main>
  )
}
