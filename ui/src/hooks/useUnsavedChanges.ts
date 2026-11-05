'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'

import { useConfirm } from '@/components/ui/confirm'

const DISCARD = {
  title: 'Leave without saving?',
  confirmLabel: 'Discard changes',
  cancelLabel: 'Keep editing',
  tone: 'danger' as const
}

/**
 * While `dirty`, warns before the tab closes or reloads and intercepts
 * in-app link clicks (sidebar, tabs, breadcrumbs) with an in-app confirm.
 * Returns `confirmDiscard()` for actions that would drop the edits.
 */
export function useUnsavedChanges(dirty: boolean, what: string) {
  const confirm = useConfirm()
  const router = useRouter()
  const pending = useRef(false)

  const confirmDiscard = useCallback(
    () =>
      confirm({
        ...DISCARD,
        description: `You have unsaved changes to ${what}.`
      }),
    [confirm, what]
  )

  useEffect(() => {
    if (!dirty) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const anchor =
        event.target instanceof Element ? event.target.closest('a') : null
      if (
        !anchor ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download')
      )
        return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      const here = new URL(window.location.href)
      if (url.pathname === here.pathname && url.search === here.search) return

      event.preventDefault()
      event.stopPropagation()
      if (pending.current) return
      pending.current = true
      void confirmDiscard().then((discard) => {
        pending.current = false
        if (discard) router.push(`${url.pathname}${url.search}${url.hash}`)
      })
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty, confirmDiscard, router])

  return confirmDiscard
}
