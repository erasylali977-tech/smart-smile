import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type Props = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost'
    fullWidth?: boolean
  }
>

export function Button({ variant = 'primary', fullWidth, className, ...props }: Props) {
  const base =
    'inline-flex h-12 select-none items-center justify-center gap-2 rounded-2xl px-4 text-sm font-extrabold leading-none transition active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100'
  const variants: Record<NonNullable<Props['variant']>, string> = {
    primary:
      'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-[0_10px_26px_rgba(16,185,129,0.35)] hover:from-emerald-400 hover:to-emerald-300',
    secondary:
      'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-[0_10px_26px_rgba(249,115,22,0.28)] hover:from-orange-400 hover:to-amber-300',
    ghost: 'border border-slate-200 bg-white/70 text-slate-900 hover:bg-white',
  }
  const width = fullWidth ? 'w-full' : ''
  const cls = [base, variants[variant], width, className ?? ''].join(' ').trim()
  return <button className={cls} {...props} />
}
