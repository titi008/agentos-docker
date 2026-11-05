'use client'

import {
  Children,
  isValidElement,
  memo,
  type ReactElement,
  type ReactNode
} from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

import { cn } from '@/lib/utils'

import { CodeBlock } from './code'

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textOf(node.props.children)
  }
  return ''
}

const components: Components = {
  h1: ({ node: _node, className, ...props }) => (
    <h1
      className={cn('mt-5 mb-2 text-xl font-semibold first:mt-0', className)}
      {...props}
    />
  ),
  h2: ({ node: _node, className, ...props }) => (
    <h2
      className={cn('mt-5 mb-2 text-lg font-semibold first:mt-0', className)}
      {...props}
    />
  ),
  h3: ({ node: _node, className, ...props }) => (
    <h3
      className={cn(
        'mt-4 mb-1.5 text-base font-semibold first:mt-0',
        className
      )}
      {...props}
    />
  ),
  h4: ({ node: _node, className, ...props }) => (
    <h4
      className={cn('mt-4 mb-1 font-semibold first:mt-0', className)}
      {...props}
    />
  ),
  h5: ({ node: _node, className, ...props }) => (
    <h5
      className={cn('mt-3 mb-1 font-semibold first:mt-0', className)}
      {...props}
    />
  ),
  h6: ({ node: _node, className, ...props }) => (
    <h6
      className={cn('mt-3 mb-1 font-semibold text-fg-2 first:mt-0', className)}
      {...props}
    />
  ),
  p: ({ node: _node, className, ...props }) => (
    <p className={cn('my-2 first:mt-0 last:mb-0', className)} {...props} />
  ),
  a: ({ node: _node, className, href, ...props }) => (
    <a
      href={typeof href === 'string' ? href : undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'text-accent underline underline-offset-2 hover:no-underline',
        className
      )}
      {...props}
    />
  ),
  ul: ({ node: _node, className, ...props }) => (
    <ul
      className={cn('my-2 list-disc space-y-1 pl-5 first:mt-0', className)}
      {...props}
    />
  ),
  ol: ({ node: _node, className, ...props }) => (
    <ol
      className={cn('my-2 list-decimal space-y-1 pl-5 first:mt-0', className)}
      {...props}
    />
  ),
  li: ({ node: _node, className, ...props }) => (
    <li className={cn('pl-0.5', className)} {...props} />
  ),
  blockquote: ({ node: _node, className, ...props }) => (
    <blockquote
      className={cn(
        'my-3 border-l-2 border-line-strong pl-3 text-fg-2',
        className
      )}
      {...props}
    />
  ),
  hr: () => <hr className="my-4 border-line" />,
  table: ({ node: _node, className, ...props }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-line">
      <table
        className={cn('w-full border-collapse text-[13px]', className)}
        {...props}
      />
    </div>
  ),
  th: ({ node: _node, className, ...props }) => (
    <th
      className={cn(
        'border-b border-line bg-hover px-3 py-2 text-left font-medium',
        className
      )}
      {...props}
    />
  ),
  td: ({ node: _node, className, ...props }) => (
    <td
      className={cn('border-b border-line px-3 py-2 align-top', className)}
      {...props}
    />
  ),
  img: ({ src, alt }) =>
    typeof src === 'string' ? (
      // Agent output links images from arbitrary hosts, so next/image can't be configured for them.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? ''}
        loading="lazy"
        className="my-2 max-w-full rounded-lg border border-line"
      />
    ) : null,
  pre: ({ children }) => {
    const child = Children.toArray(children)[0] as
      ReactElement<{ className?: string; children?: ReactNode }> | undefined
    const language = /language-([\w-]+)/.exec(
      child?.props?.className ?? ''
    )?.[1]
    const code = textOf(child?.props?.children ?? children).replace(/\n$/, '')
    return <CodeBlock code={code} label={language ?? 'code'} className="my-3" />
  },
  code: ({ node: _node, className, ...props }) => (
    <code
      className={cn(
        'rounded bg-hover px-1 py-0.5 font-mono text-[0.88em] text-fg',
        className
      )}
      {...props}
    />
  )
}

interface MarkdownProps {
  content: string
  className?: string
}

/** Renders untrusted markdown (sanitized) with the app's typography. */
export const Markdown = memo(function Markdown({
  content,
  className
}: MarkdownProps) {
  return (
    <div
      className={cn(
        'min-w-0 text-[14.5px] leading-relaxed break-words',
        className
      )}
    >
      <ReactMarkdown
        components={components}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
