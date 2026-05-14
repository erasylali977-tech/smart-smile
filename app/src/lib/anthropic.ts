export type AiScanResult = {
  cleanliness_score: number
  plaque_visible: boolean
  color_assessment: 'white' | 'yellow' | 'gray'
  recommendations: string[]
  positive_note: string
  disclaimer: string
}

export async function analyzeTeethPhoto(args: {
  language: 'ru' | 'kz'
  imageDataUrl: string
  context?: {
    age?: number | null
    braces?: boolean
    pain?: boolean
    bleeding?: boolean
    sensitivity?: boolean
    badBreath?: boolean
    note?: string
  }
}): Promise<AiScanResult> {
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

  const resp = await fetch('/api/ai/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      language: args.language,
      imageDataUrl: args.imageDataUrl,
      context: args.context ?? {},
    }),
  }).catch(() => null)

  if (!resp) throw new Error('ai_backend_unreachable')
  const parsed = (await resp.json().catch(() => null)) as unknown
  if (!resp.ok) {
    if (isObj(parsed)) {
      const code = typeof parsed.error === 'string' ? parsed.error : 'ai_error'
      const msg = typeof parsed.message === 'string' ? parsed.message : ''
      throw new Error(msg ? `${code}:${msg}` : code)
    }
    throw new Error('ai_error')
  }

  const data = isObj(parsed) ? (parsed as Partial<AiScanResult>) : null
  if (!data) throw new Error('bad_ai_response')

  const rawScore = typeof data.cleanliness_score === 'number' ? data.cleanliness_score : Number.NaN

  return {
    cleanliness_score: Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 50,
    plaque_visible: Boolean(data.plaque_visible),
    color_assessment: data.color_assessment === 'white' || data.color_assessment === 'yellow' || data.color_assessment === 'gray' ? data.color_assessment : 'gray',
    recommendations: Array.isArray(data.recommendations) ? data.recommendations.map((x) => String(x)).slice(0, 6) : [],
    positive_note: String(data.positive_note ?? ''),
    disclaimer: String(data.disclaimer ?? ''),
  }
}

export async function analyzeTeethPhotoMock(args: {
  language: 'ru' | 'kz'
  file: File
}): Promise<AiScanResult> {
  const bytes = args.file.size
  const seed = (bytes % 97) / 97
  const score = Math.max(15, Math.min(98, Math.round(45 + seed * 50)))
  const plaque = score < 70
  const color: AiScanResult['color_assessment'] = score > 82 ? 'white' : score > 58 ? 'yellow' : 'gray'

  const ru = {
    recommendations: [
      'Чистите 2 минуты, уделяя каждой зоне по 30 секунд.',
      'Используйте нить или ирригатор для межзубных промежутков.',
      'Сделайте повторный скан через 7 дней, чтобы сравнить динамику.',
    ],
    positive_note: 'Отлично, что вы следите за гигиеной и делаете регулярные проверки.',
    disclaimer: 'Это не медицинский диагноз. Оценка основана только на видимом внешнем виде.',
  }

  const kz = {
    recommendations: [
      '2 минут тазалаңыз, әр аймаққа 30 секунд бөліңіз.',
      'Тісаралық жіп немесе ирригатор қолданыңыз.',
      '7 күннен кейін қайта скан жасап, өзгерісті салыстырыңыз.',
    ],
    positive_note: 'Гигиенаға мән беріп, тұрақты тексеріп жүргеніңіз өте жақсы.',
    disclaimer: 'Бұл медициналық диагноз емес. Бағалау тек сыртқы көрініске негізделген.',
  }

  const dict = args.language === 'kz' ? kz : ru

  await new Promise((r) => setTimeout(r, 1200))

  return {
    cleanliness_score: score,
    plaque_visible: plaque,
    color_assessment: color,
    recommendations: dict.recommendations,
    positive_note: dict.positive_note,
    disclaimer: dict.disclaimer,
  }
}
