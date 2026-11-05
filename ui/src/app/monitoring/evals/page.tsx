import type { Metadata } from 'next'

import { EvalsView } from '@/features/monitoring/EvalsView'

export const metadata: Metadata = { title: 'Evaluations' }

export default function Page() {
  return <EvalsView />
}
