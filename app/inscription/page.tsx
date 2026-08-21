'use client'

import { Suspense, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function InscriptionPage() {
  return (
    <Suspense fallback={<main className="p-8 text-mute">Chargement…</main>}>
      <InscriptionForm />
    </Suspense>
  )
}

function InscriptionForm() {
  const router = useRouter()
  const search = useSearchParams()
  const ami = search.get('ami')?.toUpperCase() ?? ''
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    const data = await response.json()
    setPending(false)
    if (!response.ok) {
      setError(data.error ?? 'Inscription impossible')
      return
    }
    if (ami) {
      await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: ami }),
      })
      router.push('/amis')
    } else {
      router.push('/profil')
    }
    router.refresh()
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 py-8">
      <h1 className="font-display text-5xl">INSCRIPTION</h1>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Pseudo" className="rounded-2xl bg-panel px-4 py-4" />
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded-2xl bg-panel px-4 py-4" />
        <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" className="rounded-2xl bg-panel px-4 py-4" />
        {error ? <p className="text-kill">{error}</p> : null}
        <button disabled={pending} className="rounded-full bg-horizon py-4 font-semibold text-dusk">
          Créer le compte
        </button>
      </form>
    </main>
  )
}
