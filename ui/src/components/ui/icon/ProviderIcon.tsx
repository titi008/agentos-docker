import { Cpu } from 'lucide-react'
import type { FC } from 'react'

import { cn } from '@/lib/utils'

import {
  AgnoIcon,
  AnthropicLogo,
  AwsLogo,
  AzureLogo,
  CohereLogo,
  DeepseekLogo,
  FireworksLogo,
  GeminiLogo,
  GroqLogo,
  MistralLogo,
  OllamaLogo,
  OpenAILogo,
  XaiLogo
} from './custom-icons'

const PROVIDER_LOGOS: [match: string, logo: FC][] = [
  ['anthropic', AnthropicLogo],
  ['claude', AnthropicLogo],
  ['openai', OpenAILogo],
  ['gpt', OpenAILogo],
  ['gemini', GeminiLogo],
  ['google', GeminiLogo],
  ['aws', AwsLogo],
  ['bedrock', AwsLogo],
  ['azure', AzureLogo],
  ['mistral', MistralLogo],
  ['groq', GroqLogo],
  ['fireworks', FireworksLogo],
  ['deepseek', DeepseekLogo],
  ['cohere', CohereLogo],
  ['ollama', OllamaLogo],
  ['xai', XaiLogo],
  ['grok', XaiLogo]
]

/** Logo for a model provider or model id; falls back to a generic chip icon. */
export function ProviderIcon({
  provider,
  className
}: {
  /** Provider name or model id, matched loosely (e.g. "anthropic", "claude-sonnet-5-5"). */
  provider?: string | null
  className?: string
}) {
  const needle = (provider ?? '').toLowerCase()
  const Logo = needle
    ? PROVIDER_LOGOS.find(([match]) => needle.includes(match))?.[1]
    : undefined
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid size-4 shrink-0 place-items-center text-fg-2 [&>svg]:size-full',
        className
      )}
    >
      {Logo ? <Logo /> : <Cpu />}
    </span>
  )
}

/** The Agno mark used as the AgentOS logo. */
export function AgnoLogo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid size-4 shrink-0 place-items-center [&>svg]:size-full',
        className
      )}
    >
      <AgnoIcon />
    </span>
  )
}
