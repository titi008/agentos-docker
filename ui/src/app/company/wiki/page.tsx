import type { Metadata } from 'next'

import { WikiView } from '@/features/company/WikiView'

export const metadata: Metadata = { title: 'Company wiki' }

export default function Page() {
  return <WikiView />
}
