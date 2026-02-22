import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'API Key Tester — Internal Dev Tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 text-gray-900 text-sm antialiased">
        {children}
      </body>
    </html>
  )
}
