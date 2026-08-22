import type { ReactNode } from 'react'

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden
    />
  )
}

export function BusyLabel({
  busy,
  children,
}: {
  busy: boolean
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      {busy ? <Spinner /> : null}
      <span>{children}</span>
    </span>
  )
}
