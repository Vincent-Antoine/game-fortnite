import type { Metadata, Viewport } from 'next'
import { Anton, Outfit, Share_Tech_Mono } from 'next/font/google'
import { AppChrome } from '@/components/app-chrome'
import { SwRegister } from '@/components/sw-register'
import './globals.css'

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
})

const anton = Anton({
  variable: '--font-anton',
  subsets: ['latin'],
  weight: '400',
})

const hud = Share_Tech_Mono({
  variable: '--font-hud',
  subsets: ['latin'],
  weight: '400',
})

export const metadata: Metadata = {
  title: 'Dette Royale',
  description: 'Kills, réas, le dernier paie. Compte de soirée Fortnite entre potes.',
  applicationName: 'Dette Royale',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Dette Royale',
  },
}

export const viewport: Viewport = {
  themeColor: '#1c1633',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="fr"
      className={`${outfit.variable} ${anton.variable} ${hud.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pb-24">
        <AppChrome />
        {children}
        <SwRegister />
      </body>
    </html>
  )
}
