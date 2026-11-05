import type { Metadata } from 'next'

import { ApprovalsView } from '@/features/approvals/ApprovalsView'

export const metadata: Metadata = { title: 'Approvals' }

export default function Page() {
  return <ApprovalsView />
}
