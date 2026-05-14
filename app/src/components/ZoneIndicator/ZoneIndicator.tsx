type Props = {
  activeZone: 1 | 2 | 3 | 4
}

export function ZoneIndicator({ activeZone }: Props) {
  const zones = [
    { id: 1 as const, label: 'Верх-Л' },
    { id: 2 as const, label: 'Верх-П' },
    { id: 3 as const, label: 'Низ-Л' },
    { id: 4 as const, label: 'Низ-П' },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {zones.map((z) => (
        <div
          key={z.id}
          className={[
            'rounded-2xl border px-3 py-3 text-center text-xs font-extrabold',
            z.id === activeZone
              ? 'border-emerald-400 bg-emerald-400/15 text-emerald-800'
              : 'border-slate-200 bg-white/60 text-slate-700',
          ].join(' ')}
        >
          {z.label}
        </div>
      ))}
    </div>
  )
}
