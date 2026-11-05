import type { Metadata } from 'next'

import { TeamsView } from '@/features/studio/TeamsView'

export const metadata: Metadata = { title: 'Studio teams' }

export default function Page() {
  return <TeamsView />
}
