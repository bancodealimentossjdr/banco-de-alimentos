import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import LayoutShell from '@/components/LayoutShell'
import SessionProvider from '@/components/SessionProvider'
import AccessDeniedToast from '@/components/AccessDeniedToast'
import { Toaster } from 'react-hot-toast'
import { BRANDING } from '@/lib/branding'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: BRANDING.fullName,
    template: `%s | ${BRANDING.name}`,
  },
  description: BRANDING.description,
  applicationName: BRANDING.name,
  keywords: [
    'annonae',
    'banco de alimentos',
    'são joão del-rei',
    'doação',
    'gestão',
    'alimentos',
    'colheita solidária',
    'segurança alimentar',
    'mesa brasil',
    'cgesan',
  ],
  authors: [{ name: 'Annonae', url: BRANDING.productionUrl }],
  creator: BRANDING.name,
  publisher: BRANDING.name,
  metadataBase: new URL(BRANDING.productionUrl),
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: BRANDING.name,
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
    url: BRANDING.productionUrl,
    title: BRANDING.fullName,
    description: BRANDING.tagline,
    siteName: BRANDING.name,
    images: [
      {
        url: BRANDING.assets.logoColor,
        width: 1200,
        height: 630,
        alt: BRANDING.name,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: BRANDING.fullName,
    description: BRANDING.tagline,
    images: [BRANDING.assets.logoColor],
  },
  robots: {
    index: true,
    follow: true,
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
