'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

export default function ConnexionPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await response.json()
    setPending(false)
    if (!response.ok) {
      setError(data.error ?? 'Connexion impossible')
      return
    }
    router.push('/profil')
    router.refresh()
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 py-8">
      <h1 className="font-display text-5xl">CONNEXION</h1>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded-2xl bg-panel px-4 py-4" />
        <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" className="rounded-2xl bg-panel px-4 py-4" />
        {error ? <p className="text-kill">{error}</p> : null}
        <button disabled={pending} className="rounded-full bg-horizon py-4 font-semibold text-dusk">
          Entrer
        </button>
      </form>
    </main>
  )
}
