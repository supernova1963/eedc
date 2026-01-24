import './globals.css'
import type { Metadata } from 'next'
import AppLayout from '@/components/AppLayout'

export const metadata: Metadata = {
  title: 'EEDC - Energy Data Collection',
  description: 'Electronic Energy Data Collection',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body>
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  )
}
