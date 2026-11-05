import type { Metadata } from 'next'

import { UsageView } from '@/features/monitoring/UsageView'

export const metadata: Metadata = { title: 'Usage & costs' }

export default function Page() {
  return <UsageView />
}
