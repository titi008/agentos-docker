import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  devIndicators: false,
  output: 'standalone',
  // The repository keeps its own agent instructions; don't let `next dev` write AGENTS.md.
  agentRules: false
}

export default nextConfig
