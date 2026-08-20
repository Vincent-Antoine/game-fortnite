import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dette Royale',
    short_name: 'Dette',
    description: 'Compte Fortnite entre potes : kills, réas, dettes.',
    start_url: '/',
    display: 'standalone',
    background_color: '#1c1633',
    theme_color: '#1c1633',
    lang: 'fr',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
