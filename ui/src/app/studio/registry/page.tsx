import type { Metadata } from 'next'

import { RegistryView } from '@/features/studio/RegistryView'

export const metadata: Metadata = { title: 'Studio registry' }

export default function Page() {
  return <RegistryView />
}
