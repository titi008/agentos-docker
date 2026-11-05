import type { Metadata } from 'next'

import { FilesView } from '@/features/knowledge/FilesView'

export const metadata: Metadata = { title: 'Notes & files' }

export default function Page() {
  return <FilesView />
}
