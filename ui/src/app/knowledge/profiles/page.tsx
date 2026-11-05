import type { Metadata } from 'next'

import { ProfilesView } from '@/features/knowledge/ProfilesView'

export const metadata: Metadata = { title: 'Learned profiles' }

export default function Page() {
  return <ProfilesView />
}
