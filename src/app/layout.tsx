import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import LayoutShell from '@/components/LayoutShell'
import SessionProvider from '@/components/SessionProvider'
import AccessDeniedToast from '@/components/AccessDeniedToast'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Banco de Alimentos',
  description: 'Sistema de gestão de banco de alimentos',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
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
