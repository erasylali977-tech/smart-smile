import type { PropsWithChildren } from 'react'

export function Card({ children }: PropsWithChildren) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_14px_40px_rgba(2,6,23,0.08)] backdrop-blur">
      {children}
    </div>
  )
}
