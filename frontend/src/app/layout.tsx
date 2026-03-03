import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Career Mode Live | Multi-Agent Voice Coaching Panel',
  description: 'Real-time voice career coaching with 3 AI personas who listen, debate, and provoke. Built with Gemini.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-bg-primary text-text-primary antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
