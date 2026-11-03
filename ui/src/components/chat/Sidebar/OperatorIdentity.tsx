'use client'

import { useState, useEffect } from 'react'
import { User, ShieldCheck, ShieldAlert } from 'lucide-react'
import { useStore } from '@/store'

interface AuthMeResponse {
  user_id: string
  is_authenticated: boolean
  source: string
}

const OperatorIdentity = () => {
  const { userId, setUserId } = useStore()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)

  useEffect(() => {
    let isSubscribed = true
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) throw new Error('Auth check failed')
        return res.json() as Promise<AuthMeResponse>
      })
      .then((data) => {
        if (isSubscribed && data.user_id) {
          setUserId(data.user_id)
          setIsAuthenticated(data.is_authenticated)
        }
      })
      .catch(() => {
        // Fall back gracefully to existing user ID
      })
    return () => {
      isSubscribed = false
    }
  }, [setUserId])

  return (
    <div className="flex w-full flex-col gap-1.5 rounded-xl border border-primary/15 bg-accent/40 p-2.5 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted tracking-wider">
          <User className="size-3 text-primary" />
          <span>Operator</span>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
            isAuthenticated
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
          }`}
        >
          {isAuthenticated ? (
            <ShieldCheck className="size-2.5 text-emerald-400" />
          ) : (
            <ShieldAlert className="size-2.5 text-zinc-400" />
          )}
          {isAuthenticated ? 'Zero Trust' : 'Local User'}
        </span>
      </div>
      <div
        className="truncate font-mono text-[11px] text-foreground font-medium"
        title={userId}
      >
        {userId}
      </div>
    </div>
  )
}

export default OperatorIdentity
