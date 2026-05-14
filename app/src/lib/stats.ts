import type { AiScan, BrushingSession } from '../store/useStore'
import { addDays, startOfDay, toISODate } from './date'

export function sessionsByDate(sessions: BrushingSession[]) {
  const map = new Map<string, BrushingSession[]>()
  for (const s of sessions) {
    const date = s.sessionDate
    const arr = map.get(date) ?? []
    arr.push(s)
    map.set(date, arr)
  }
  return map
}

export function countTodaySessions(sessions: BrushingSession[], now = new Date()) {
  const today = toISODate(now)
  return sessions.filter((s) => s.sessionDate === today).length
}

export function computeStreak(sessions: BrushingSession[], now = new Date()) {
  const byDate = sessionsByDate(sessions)
  let streak = 0
  for (let i = 0; i < 3650; i += 1) {
    const date = toISODate(addDays(startOfDay(now), -i))
    const hasAny = (byDate.get(date)?.length ?? 0) > 0
    if (!hasAny) break
    streak += 1
  }
  return streak
}

export function maxStreak(sessions: BrushingSession[]) {
  const byDate = sessionsByDate(sessions)
  const dates = Array.from(byDate.keys()).sort()
  let best = 0
  let current = 0
  let prev: string | null = null
  for (const date of dates) {
    if (!prev) {
      current = 1
      best = Math.max(best, current)
      prev = date
      continue
    }
    const prevDate = new Date(`${prev}T00:00:00`)
    const next = toISODate(addDays(prevDate, 1))
    if (date === next) current += 1
    else current = 1
    best = Math.max(best, current)
    prev = date
  }
  return best
}

export function lastScan(scans: AiScan[]) {
  return scans[0] ?? null
}

export function scanSeries(scans: AiScan[], limit = 20) {
  const slice = scans.slice(0, limit).reverse()
  return slice.map((s) => ({
    date: s.createdAt,
    score: s.cleanlinessScore,
  }))
}

