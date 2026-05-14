import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ZoneIndicator } from '../../components/ZoneIndicator/ZoneIndicator'
import { DentalHeroGame } from '../../components/DentalHero/DentalHeroGame'
import { t } from '../../lib/i18n'
import { toISODate } from '../../lib/date'
import { useStore } from '../../store/useStore'

type Status = 'idle' | 'running' | 'paused' | 'finished'

function formatMMSS(seconds: number) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(Math.floor(seconds % 60)).padStart(2, '0')
  return `${mm}:${ss}`
}

export function TimerPage() {
  const location = useLocation()
  const language = useStore((s) => s.language)
  const accountType = useStore((s) => s.accountType)
  const adultAge = useStore((s) => s.age)
  const childAge = useStore((s) => s.childProfiles[0]?.age ?? null)
  const addCoins = useStore((s) => s.addCoins)
  const addBrushingSession = useStore((s) => s.addBrushingSession)

  const [status, setStatus] = useState<Status>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const startedAtRef = useRef<Date | null>(null)
  const finishedOnce = useRef(false)
  const prevZone = useRef<number>(1)

  const totalSeconds = 120
  const totalMs = totalSeconds * 1000

  const isKid = useMemo(() => {
    const qp = new URLSearchParams(location.search)
    const forceKid = qp.get('kid') === '1'
    if (forceKid) return true
    const age = accountType === 'parent' ? childAge : adultAge
    return typeof age === 'number' && age < 12
  }, [accountType, adultAge, childAge, location.search])

  const secondsLeft = Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000))
  const progress = Math.min(1, elapsedMs / totalMs)
  const zone = (Math.min(4, Math.floor(elapsedMs / 30000) + 1) || 1) as 1 | 2 | 3 | 4

  useEffect(() => {
    if (zone !== prevZone.current) {
      prevZone.current = zone
      if (navigator.vibrate) navigator.vibrate(40)
    }
  }, [zone])

  useEffect(() => {
    if (status !== 'running') return

    const startTs = performance.now() - elapsedMs
    const id = window.setInterval(() => {
      const next = performance.now() - startTs
      if (next >= totalMs) {
        setElapsedMs(totalMs)
        setStatus('finished')
        return
      }
      setElapsedMs(next)
    }, 200)
    return () => window.clearInterval(id)
  }, [elapsedMs, status, totalMs])

  useEffect(() => {
    if (status !== 'finished' || finishedOnce.current) return
    finishedOnce.current = true

    const earned = isKid ? 50 : 20
    addCoins(earned)

    const startedAt = startedAtRef.current ?? new Date()
    addBrushingSession({
      startedAt: startedAt.toISOString(),
      durationSeconds: totalSeconds,
      zonesCompleted: 4,
      coinsEarned: earned,
      sessionDate: toISODate(startedAt),
    })

    if (navigator.vibrate) navigator.vibrate([80, 40, 80])
  }, [addBrushingSession, addCoins, isKid, status])

  const onStart = () => {
    startedAtRef.current = new Date()
    finishedOnce.current = false
    prevZone.current = 1
    setElapsedMs(0)
    setStatus('running')
  }

  const onPause = () => setStatus('paused')
  const onResume = () => setStatus('running')

  const onReset = () => {
    startedAtRef.current = null
    finishedOnce.current = false
    prevZone.current = 1
    setElapsedMs(0)
    setStatus('idle')
  }

  const circle = 94
  const r = 42
  const c = 2 * Math.PI * r
  const dash = c * (1 - progress)

  const onKidComplete = useCallback(
    (payload: { startedAtISO: string; coinsEarned: number; durationSeconds: number }) => {
      const earned = Math.max(50, Math.round(payload.coinsEarned || 0))
      addCoins(earned)
      addBrushingSession({
        startedAt: payload.startedAtISO,
        durationSeconds: payload.durationSeconds,
        zonesCompleted: 4,
        coinsEarned: earned,
        sessionDate: toISODate(new Date(payload.startedAtISO)),
      })
      if (navigator.vibrate) navigator.vibrate([80, 40, 80])
    },
    [addBrushingSession, addCoins],
  )

  if (isKid) {
    return <DentalHeroGame language={language} onComplete={onKidComplete} />
  }

  return (
    <div className="grid gap-3">
      <Card>
        <div className="flex items-center justify-between">
          <div className="text-sm font-extrabold text-slate-900">{t(language, 'timer.title')}</div>
          <div className="text-xs font-semibold text-slate-600">{t(language, 'timer.zone', { n: zone })}</div>
        </div>

        <div className="mt-4 flex items-center justify-center">
          <div className="relative">
            <svg width={circle} height={circle} viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={r} stroke="rgba(2,6,23,0.10)" strokeWidth="8" fill="transparent" />
              <circle
                cx="50"
                cy="50"
                r={r}
                stroke="rgba(16,185,129,0.95)"
                strokeWidth="8"
                fill="transparent"
                strokeLinecap="round"
                strokeDasharray={`${c} ${c}`}
                strokeDashoffset={dash}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl font-extrabold text-slate-900">{formatMMSS(secondsLeft)}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">{status === 'finished' ? t(language, 'timer.finish') : null}</div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <ZoneIndicator activeZone={zone} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {status === 'idle' ? (
            <>
              <Button fullWidth onClick={onStart}>
                {t(language, 'timer.start')}
              </Button>
              <Button fullWidth variant="secondary" onClick={onReset} disabled>
                {t(language, 'common.cancel')}
              </Button>
            </>
          ) : null}

          {status === 'running' ? (
            <>
              <Button fullWidth variant="secondary" onClick={onPause}>
                {t(language, 'timer.pause')}
              </Button>
              <Button fullWidth variant="ghost" onClick={onReset}>
                {t(language, 'common.cancel')}
              </Button>
            </>
          ) : null}

          {status === 'paused' ? (
            <>
              <Button fullWidth onClick={onResume}>
                {t(language, 'timer.resume')}
              </Button>
              <Button fullWidth variant="ghost" onClick={onReset}>
                {t(language, 'common.cancel')}
              </Button>
            </>
          ) : null}

          {status === 'finished' ? (
            <>
              <Button fullWidth onClick={onStart}>
                {t(language, 'timer.start')}
              </Button>
              <Button fullWidth variant="secondary" onClick={onReset}>
                {t(language, 'common.ready')}
              </Button>
            </>
          ) : null}
        </div>
      </Card>

      {status === 'finished' ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-emerald-300 bg-emerald-500/10 p-4"
        >
          <div className="text-sm font-extrabold text-emerald-800">{isKid ? t(language, 'timer.kid.reward') : t(language, 'timer.adult.reward')}</div>
          {isKid ? (
            <div className="mt-1 text-xs font-semibold text-emerald-800/80">
              Факт: чистка 2 минуты помогает убрать налёт лучше, чем 1 минута.
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </div>
  )
}
