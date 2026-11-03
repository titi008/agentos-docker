'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { TextArea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useStore } from '@/store'
import useAIChatStreamHandler from '@/hooks/useAIStreamHandler'
import { useQueryState } from 'nuqs'
import Icon from '@/components/ui/icon'
import { Paperclip, FileText, X } from 'lucide-react'

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const ChatInput = () => {
  const { chatInputRef } = useStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { handleStreamResponse } = useAIChatStreamHandler()
  const [selectedAgent] = useQueryState('agent')
  const [teamId] = useQueryState('team')
  const [inputMessage, setInputMessage] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const isStreaming = useStore((state) => state.isStreaming)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const newFiles = Array.from(e.target.files)
    setSelectedFiles((prev) => [...prev, ...newFiles])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleSubmit = async () => {
    if (!inputMessage.trim() && selectedFiles.length === 0) return

    const currentMessage = inputMessage.trim()
    const filesToSend = [...selectedFiles]

    setInputMessage('')
    setSelectedFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''

    try {
      if (filesToSend.length > 0) {
        const formData = new FormData()
        formData.append(
          'message',
          currentMessage || 'Please review and analyze the attached file(s).'
        )
        filesToSend.forEach((file) => {
          formData.append('files', file)
        })
        await handleStreamResponse(formData)
      } else {
        await handleStreamResponse(currentMessage)
      }
    } catch (error) {
      toast.error(
        `Error submitting message: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  return (
    <div className="relative mx-auto mb-1 flex w-full max-w-2xl flex-col items-center justify-center gap-y-2 font-geist">
      {/* File Preview Chips */}
      {selectedFiles.length > 0 && (
        <div className="flex w-full flex-wrap gap-2 px-1">
          {selectedFiles.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-accent/60 px-2.5 py-1 text-xs text-foreground font-dmmono shadow-sm"
            >
              <FileText className="size-3.5 text-primary" />
              <span className="max-w-[180px] truncate" title={file.name}>
                {file.name}
              </span>
              <span className="text-[10px] text-muted">
                ({formatBytes(file.size)})
              </span>
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="ml-1 rounded-sm p-0.5 text-muted hover:bg-destructive/20 hover:text-destructive transition"
                title="Remove file"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex w-full items-end justify-center gap-x-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.txt,.md,.markdown,.csv,.json,.py,.js,.ts,.html,.css,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.m4a"
        />
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!(selectedAgent || teamId) || isStreaming}
          size="icon"
          title="Attach files (PDF, images, CSV, docs)"
          className="rounded-xl border border-accent bg-primaryAccent p-5 text-muted hover:text-primary hover:border-primary/40 transition shrink-0"
        >
          <Paperclip className="size-4" />
        </Button>
        <TextArea
          placeholder={'Ask anything or attach files'}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.nativeEvent.isComposing &&
              !e.shiftKey &&
              !isStreaming
            ) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          className="w-full border border-accent bg-primaryAccent px-4 text-sm text-primary focus:border-accent"
          disabled={!(selectedAgent || teamId)}
          ref={chatInputRef}
        />
        <Button
          onClick={handleSubmit}
          disabled={
            !(selectedAgent || teamId) ||
            (!inputMessage.trim() && selectedFiles.length === 0) ||
            isStreaming
          }
          size="icon"
          className="rounded-xl bg-primary p-5 text-primaryAccent shrink-0"
        >
          <Icon type="send" color="primaryAccent" />
        </Button>
      </div>
    </div>
  )
}

export default ChatInput
