export function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function startOfDay(d: Date) {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function addDays(d: Date, days: number) {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

export function formatShortDate(isoDate: string, lang: 'ru' | 'kz') {
  const d = new Date(`${isoDate}T00:00:00`)
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'kk-KZ', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(d)
}

