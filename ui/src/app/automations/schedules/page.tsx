import type { Metadata } from 'next'

import { SchedulesView } from '@/features/automations/SchedulesView'

export const metadata: Metadata = { title: 'Schedules' }

export default function Page() {
  return <SchedulesView />
}
