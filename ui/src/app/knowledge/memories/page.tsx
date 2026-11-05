import type { Metadata } from 'next'

import { MemoriesView } from '@/features/knowledge/MemoriesView'

export const metadata: Metadata = { title: 'Memories' }

export default function Page() {
  return <MemoriesView />
}
