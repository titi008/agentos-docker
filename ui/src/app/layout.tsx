import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import { Providers } from '@/components/providers'
import { AppShell } from '@/components/shell/AppShell'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap'
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap'
})

export const metadata: Metadata = {
  title: { default: 'AgentOS', template: '%s · AgentOS' },
  description:
    'Chat with your agents, approve their actions, and manage the company, automations, knowledge and monitoring of your AgentOS.'
}

export const viewport: Viewport = {
  // Shrink the page when the on-screen keyboard opens so the chat composer stays visible.
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#121215' },
    { media: '(prefers-color-scheme: light)', color: '#fafafb' }
  ]
}

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
