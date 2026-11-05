import type { Metadata } from 'next'

import { AgentsView } from '@/features/studio/AgentsView'

export const metadata: Metadata = { title: 'Studio agents' }

export default function Page() {
  return <AgentsView />
}
