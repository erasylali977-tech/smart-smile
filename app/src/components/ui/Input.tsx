import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & { label?: string }

export function Input({ label, className, ...props }: Props) {
  return (
    <label className="block">
      {label ? <div className="mb-1 text-xs font-semibold text-slate-600">{label}</div> : null}
      <input
        className={[
          'w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-sm text-slate-900 outline-none shadow-[0_8px_20px_rgba(2,6,23,0.06)]',
          'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25',
          className ?? '',
        ].join(' ')}
        {...props}
      />
    </label>
  )
}
