import type { Metadata } from 'next'

import { ChatView } from '@/features/chat/ChatView'

// The root page shares the layout's segment, so the title template doesn't apply here.
export const metadata: Metadata = { title: { absolute: 'Chat · AgentOS' } }

export default function Page() {
  return <ChatView />
}
