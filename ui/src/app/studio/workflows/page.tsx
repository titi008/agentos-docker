import type { Metadata } from 'next'

import { WorkflowsView } from '@/features/studio/WorkflowsView'

export const metadata: Metadata = { title: 'Studio workflows' }

export default function Page() {
  return <WorkflowsView />
}
