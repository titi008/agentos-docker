import type { Metadata } from 'next'

import { DocumentsView } from '@/features/knowledge/DocumentsView'

export const metadata: Metadata = { title: 'Knowledge documents' }

export default function Page() {
  return <DocumentsView />
}
