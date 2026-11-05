import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-lg font-semibold">Page not found</p>
      <p className="text-[13px] text-fg-3">
        This page doesn&apos;t exist or has moved.
      </p>
      <Button variant="primary" asChild>
        <Link href="/">Go to chat</Link>
      </Button>
    </div>
  )
}
