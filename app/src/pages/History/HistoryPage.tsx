import { useMemo } from 'react'
import { Card } from '../../components/ui/Card'
import { t } from '../../lib/i18n'
import { addDays, formatShortDate, startOfDay, toISODate } from '../../lib/date'
import { useStore } from '../../store/useStore'

function intensity(count: number) {
  if (count >= 2) return 'bg-emerald-400/80'
  if (count === 1) return 'bg-amber-300/80'
  return 'bg-slate-200'
}

export function HistoryPage() {
  const language = useStore((s) => s.language)
  const sessions = useStore((s) => s.brushingSessions)
  const scans = useStore((s) => s.aiScans)
  const dentCoins = useStore((s) => s.dentCoins)

  const byDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sessions) map.set(s.sessionDate, (map.get(s.sessionDate) ?? 0) + 1)
    return map
  }, [sessions])

  const days = useMemo(() => {
    const base = startOfDay(new Date())
    const items: { date: string; count: number }[] = []
    for (let i = 29; i >= 0; i -= 1) {
      const d = addDays(base, -i)
      const iso = toISODate(d)
      items.push({ date: iso, count: byDate.get(iso) ?? 0 })
    }
    return items
  }, [byDate])

  const scanSeries = useMemo(() => {
    const slice = scans.slice(0, 12).reverse()
    return slice.map((s) => ({ x: s.createdAt.slice(0, 10), y: s.cleanlinessScore }))
  }, [scans])

  const chart = useMemo(() => {
    const w = 280
    const h = 120
    if (scanSeries.length < 2) return { w, h, points: '' }
    const ys = scanSeries.map((p) => p.y)
    const minY = Math.min(...ys, 0)
    const maxY = Math.max(...ys, 100)
    const span = Math.max(1, maxY - minY)
    const pts = scanSeries
      .map((p, i) => {
        const x = (i / (scanSeries.length - 1)) * w
        const y = h - ((p.y - minY) / span) * h
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
    return { w, h, points: pts }
  }, [scanSeries])

  return (
    <div className="grid gap-3">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-slate-900">{t(language, 'history.title')}</div>
            <div className="mt-1 text-xs font-semibold text-slate-600">
              {language === 'kz' ? 'Күнделікті әдет + прогресс' : 'Ежедневная привычка + прогресс'}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-500/10 px-3 py-2 text-xs font-extrabold text-emerald-800">
            {dentCoins} coins
          </div>
        </div>
        <div className="mt-3 grid grid-cols-10 gap-2">
          {days.map((d) => (
            <div key={d.date} className="flex flex-col items-center gap-1">
              <div className={['h-5 w-5 rounded-md border border-slate-200', intensity(d.count)].join(' ')} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-extrabold text-slate-700">
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span>{language === 'kz' ? '2+' : '2+'}</span>
          </div>
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span>1</span>
          </div>
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            <span>0</span>
          </div>
        </div>
      </Card>

      <Card>
        <div className="text-sm font-extrabold text-slate-900">AI-сканы</div>
        {scanSeries.length >= 2 ? (
          <div className="mt-3 overflow-x-auto">
            <svg width={chart.w} height={chart.h} viewBox={`0 0 ${chart.w} ${chart.h}`}>
              <polyline points={chart.points} fill="none" stroke="rgba(16,185,129,0.95)" strokeWidth="3" strokeLinejoin="round" />
            </svg>
            <div className="mt-2 flex justify-between text-[10px] font-semibold text-slate-500">
              <span>{formatShortDate(scanSeries[0].x, language)}</span>
              <span>{formatShortDate(scanSeries[scanSeries.length - 1].x, language)}</span>
            </div>
          </div>
        ) : (
          <div className="mt-2 rounded-3xl border border-slate-200 bg-white/70 px-3 py-3 text-xs font-semibold text-slate-600">
            {language === 'kz' ? 'Әлі дерек жоқ — AI-скан жасап көріңіз' : 'Пока нет данных — сделайте AI-скан'}
          </div>
        )}
      </Card>

      <Card>
        <div className="text-sm font-extrabold text-slate-900">Сессии чистки</div>
        <div className="mt-3 grid gap-2">
          {sessions.slice(0, 8).map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white/70 px-3 py-3">
              <div className="text-sm font-semibold text-slate-800">{formatShortDate(s.sessionDate, language)}</div>
              <div className="text-xs font-semibold text-slate-500">{s.coinsEarned} coins</div>
            </div>
          ))}
          {sessions.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white/70 px-3 py-3 text-xs font-semibold text-slate-600">
              {language === 'kz' ? 'Әлі сессия жоқ — бүгін бастаңыз' : 'Пока нет сессий — начните сегодня'}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  )
}
