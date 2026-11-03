'use client'

import ChatInput from './ChatInput'
import MessageArea from './MessageArea'

const ChatArea = () => {
  return (
    <div className="relative m-0 md:m-1.5 flex flex-1 flex-col rounded-xl bg-background h-full min-h-0 overflow-hidden">
      <MessageArea />
      <div className="sticky bottom-0 ml-0 md:ml-9 px-2 md:px-4 pb-2 z-10">
        <ChatInput />
      </div>
    </div>
  )
}

export default ChatArea
