'use client'

import Sidebar from '@/components/chat/Sidebar/Sidebar'
import { MobileHeader } from '@/components/chat/MobileHeader'
import { ChatArea } from '@/components/chat/ChatArea'
import { StudioView } from '@/components/views/StudioView'
import { ObservabilityView } from '@/components/views/ObservabilityView'
import { KnowledgeMemoryView } from '@/components/views/KnowledgeMemoryView'
import { OperationsView } from '@/components/views/OperationsView'
import { useStore } from '@/store'
import { Suspense } from 'react'

export default function Home() {
  const hasEnvToken = !!process.env.NEXT_PUBLIC_OS_SECURITY_KEY
  const envToken = process.env.NEXT_PUBLIC_OS_SECURITY_KEY || ''
  const { activeView } = useStore()

  return (
    <Suspense
      fallback={
        <div className="p-4 text-xs font-dmmono text-muted">
          Loading workspace...
        </div>
      }
    >
      <div className="flex h-screen h-dvh min-h-dvh w-full flex-col md:flex-row bg-background/80 overflow-hidden">
        <MobileHeader />
        <Sidebar hasEnvToken={hasEnvToken} envToken={envToken} />
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {activeView === 'chat' && <ChatArea />}
          {activeView === 'studio' && <StudioView />}
          {activeView === 'observability' && <ObservabilityView />}
          {activeView === 'knowledge' && <KnowledgeMemoryView />}
          {activeView === 'operations' && <OperationsView />}
        </main>
      </div>
    </Suspense>
  )
}
