'use client'

import { useEffect, useState } from 'react'
import { vapidToBytes } from '@/lib/vapid'

type Status = 'loading' | 'off' | 'on' | 'denied' | 'unsupported' | 'pending' | 'error'

export function PushToggle() {
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('denied')
      return
    }
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setStatus(subscription ? 'on' : 'off'))
      .catch(() => setStatus('off'))
  }, [])

  async function enable() {
    setError('')
    setStatus('pending')
    try {
      const keyResponse = await fetch('/api/push/vapid')
      const keyData = await keyResponse.json()
      if (!keyResponse.ok) {
        throw new Error(keyData.error ?? 'Push indisponible')
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off')
        return
      }
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidToBytes(keyData.key) as BufferSource,
      })
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Enregistrement impossible')
      }
      setStatus('on')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setStatus('error')
    }
  }

  return (
    <section className="rounded-3xl bg-panel p-4">
      <p className="font-hud text-xs tracking-[0.2em] text-gold">NOTIFICATIONS TÉLÉPHONE</p>
      <p className="mt-1 text-sm text-mute">
        Invitations de session et demandes d’amis, même si l’app est fermée. Sur iPhone, ajoute d’abord l’app à l’écran
        d’accueil.
      </p>
      {status === 'on' ? (
        <p className="mt-3 text-sm text-rez">Notifications activées sur cet appareil.</p>
      ) : null}
      {status === 'denied' ? (
        <p className="mt-3 text-sm text-kill">Permission refusée. Réactive-la dans les réglages du téléphone.</p>
      ) : null}
      {status === 'unsupported' ? (
        <p className="mt-3 text-sm text-mute">Ce navigateur ne gère pas le push.</p>
      ) : null}
      {status === 'off' || status === 'error' || status === 'pending' ? (
        <button
          type="button"
          disabled={status === 'pending'}
          onClick={() => void enable()}
          className="mt-3 w-full rounded-full bg-horizon py-3 font-semibold text-dusk disabled:opacity-50"
        >
          {status === 'pending' ? 'Activation…' : 'Activer les notifs'}
        </button>
      ) : null}
      {error ? <p className="mt-2 text-sm text-kill">{error}</p> : null}
    </section>
  )
}
