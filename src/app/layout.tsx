import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import LayoutShell from '@/components/LayoutShell'
import SessionProvider from '@/components/SessionProvider'
import AccessDeniedToast from '@/components/AccessDeniedToast'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Banco de Alimentos',
    template: '%s | Banco de Alimentos',
  },
  description: 'Sistema de gestão do Banco de Alimentos de São João del-Rei',
  // ❌ REMOVIDO: manifest: '/manifest.json' (vamos colocar manualmente no <head>)
  applicationName: 'Banco de Alimentos',
  keywords: [
    'banco de alimentos',
    'são joão del-rei',
    'doação',
    'gestão',
    'alimentos',
    'colheita solidária',
  ],
  authors: [{ name: 'Banco de Alimentos SJDR' }],
  creator: 'Banco de Alimentos SJDR',
  publisher: 'Banco de Alimentos SJDR',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Banco de Alimentos',
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
  icon: [
    { url: '/icons/favicon.ico', sizes: 'any', type: 'image/x-icon' },
    { url: '/icons/favicon.svg', type: 'image/svg+xml' },
    { url: '/icons/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    { url: '/icons/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png' },
    { url: '/icons/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png' },
  ],
  apple: [
    { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  ],
  shortcut: '/icons/favicon.ico',
},
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://bancodealimentos.local',
    title: 'Banco de Alimentos',
    description: 'Sistema de gestão do Banco de Alimentos de São João del-Rei',
    siteName: 'Banco de Alimentos',
  },
}

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        {/* 🔑 Manifest com use-credentials para funcionar com NextAuth */}
        <link
          rel="manifest"
          href="/manifest.json"
          crossOrigin="use-credentials"
        />
      </head>
      <body className={`${inter.className} bg-gray-50`}>
        <SessionProvider>
          <LayoutShell>{children}</LayoutShell>
          <AccessDeniedToast />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 5000,
              style: {
                fontSize: '14px',
                maxWidth: '420px',
              },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  )
}
