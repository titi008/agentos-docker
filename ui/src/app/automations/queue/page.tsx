import type { Metadata } from 'next'

import { QueueView } from '@/features/automations/QueueView'

export const metadata: Metadata = { title: 'Job queue' }

export default function Page() {
  return <QueueView />
}
