import type { Metadata } from 'next'

import { TracesView } from '@/features/monitoring/TracesView'

export const metadata: Metadata = { title: 'Traces' }

export default function Page() {
  return <TracesView />
}
