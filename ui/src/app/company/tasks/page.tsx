import type { Metadata } from 'next'

import { TasksView } from '@/features/company/TasksView'

export const metadata: Metadata = { title: 'Company tasks' }

export default function Page() {
  return <TasksView />
}
