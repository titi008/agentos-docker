'use client'

import { Check, Copy } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'

import { Button, type ButtonProps } from './button'

export async function copyToClipboard(
  text: string,
  successMessage = 'Copied to clipboard'
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(successMessage)
    return true
  } catch {
    toast.error("Couldn't copy. Your browser blocked clipboard access.")
    return false
  }
}

interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  value: string
  /** Visible label; omit for an icon-only button (then pass aria-label). */
  label?: string
  successMessage?: string
}

export function CopyButton({
  value,
  label,
  successMessage,
  size,
  variant = 'ghost',
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  return (
    <Button
      variant={variant}
      size={size ?? (label ? 'sm' : 'icon-sm')}
      aria-label={label ? undefined : (props['aria-label'] ?? 'Copy')}
      onClick={async () => {
        if (await copyToClipboard(value, successMessage)) setCopied(true)
      }}
      {...props}
    >
      {copied ? <Check /> : <Copy />}
      {label}
    </Button>
  )
}

interface CodeBlockProps {
  code: string
  /** Header label, e.g. a language or "Arguments". */
  label?: ReactNode
  copyable?: boolean
  className?: string
  maxHeight?: string
}

export function CodeBlock({
  code,
  label,
  copyable = true,
  className,
  maxHeight = '24rem'
}: CodeBlockProps) {
  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden rounded-[10px] border border-line bg-canvas',
        className
      )}
    >
      {label || copyable ? (
        <div className="flex items-center justify-between gap-2 border-b border-line py-1 pr-1.5 pl-3 text-xs text-fg-3">
          <span className="truncate font-mono">{label}</span>
          {copyable ? (
            <CopyButton
              value={code}
              aria-label={`Copy ${typeof label === 'string' ? label : 'code'}`}
            />
          ) : null}
        </div>
      ) : null}
      <pre
        className="overflow-auto px-3.5 py-3 font-mono text-[12.5px] leading-relaxed whitespace-pre text-fg-2"
        style={{ maxHeight }}
      >
        <code>{code}</code>
      </pre>
    </div>
  )
}

/** Pretty-print any value for a CodeBlock. */
export function formatJson(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}
