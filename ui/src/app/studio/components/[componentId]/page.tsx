import type { Metadata } from 'next'

import { ComponentDetailView } from '@/features/studio/ComponentDetailView'

export const metadata: Metadata = { title: 'Studio component' }

export default async function Page({
  params
}: {
  params: Promise<{ componentId: string }>
}) {
  const { componentId } = await params
  return <ComponentDetailView componentId={decodeURIComponent(componentId)} />
}
