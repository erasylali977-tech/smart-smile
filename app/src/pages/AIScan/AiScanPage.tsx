import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ShieldAlert, Upload } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { t } from '../../lib/i18n'
import { analyzeTeethPhoto } from '../../lib/anthropic'
import { SHOP_ITEMS, useStore } from '../../store/useStore'

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read_failed'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

export function AiScanPage() {
  const language = useStore((s) => s.language)
  const addAiScan = useStore((s) => s.addAiScan)
  const dentCoins = useStore((s) => s.dentCoins)
  const ownedShopItems = useStore((s) => s.ownedShopItems)
  const buyShopItem = useStore((s) => s.buyShopItem)
  const accountType = useStore((s) => s.accountType)
  const adultAge = useStore((s) => s.age)
  const childProfiles = useStore((s) => s.childProfiles)

  const [aiConfig, setAiConfig] = useState<{ hasApiKey: boolean; apiKeyFormatOk: boolean; apiKeyLength: number; model: string } | null>(null)
  const [aiConfigError, setAiConfigError] = useState<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [pain, setPain] = useState(false)
  const [bleeding, setBleeding] = useState(false)
  const [sensitivity, setSensitivity] = useState(false)
  const [braces, setBraces] = useState(false)
  const [result, setResult] = useState<null | {
    score: number
    color: 'white' | 'yellow' | 'gray'
    plaque: boolean
    recommendations: string[]
    positive: string
    disclaimer: string
  }>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    setAiConfig(null)
    setAiConfigError(null)
    fetch('/api/config', { signal: ctrl.signal })
      .then((r) => r.json() as Promise<unknown>)
      .then((data) => {
        if (!isObj(data)) throw new Error('bad_config')
        const hasApiKey = Boolean(data.hasApiKey)
        const apiKeyFormatOk = Boolean(data.apiKeyFormatOk)
        const apiKeyLength = typeof data.apiKeyLength === 'number' ? data.apiKeyLength : 0
        const model = typeof data.model === 'string' ? data.model : 'unknown'
        setAiConfig({ hasApiKey, apiKeyFormatOk, apiKeyLength, model })
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return
        setAiConfigError(String(e?.message ?? e))
      })
    return () => ctrl.abort()
  }, [])

  const scoreColor = useMemo(() => {
    const score = result?.score ?? null
    if (score === null) return 'text-slate-700'
    if (score >= 80) return 'text-emerald-700'
    if (score >= 50) return 'text-amber-700'
    return 'text-rose-700'
  }, [result])

  const symptomTitle = language === 'kz' ? 'Белгілер (болса)' : 'Симптомы (если есть)'
  const painLabel = language === 'kz' ? 'Ауыру' : 'Боль'
  const bleedingLabel = language === 'kz' ? 'Қан кету' : 'Кровоточивость'
  const sensitivityLabel = language === 'kz' ? 'Сезімталдық' : 'Чувствительность'
  const bracesLabel = language === 'kz' ? 'Брекет/элайнер' : 'Брекеты/элайнеры'
  const aiReadyLabel = language === 'kz' ? 'AI дайын' : 'AI готов'
  const productsTitle = language === 'kz' ? 'Ұсынылатын құралдар' : 'Рекомендуемые средства'
  const buyLabel = language === 'kz' ? 'Алу' : 'Купить'
  const openLabel = language === 'kz' ? 'Сілтеме' : 'Ссылка'
  const balanceLabel = language === 'kz' ? 'Баланс' : 'Баланс'

  const suggestedProductIds = useMemo(() => {
    const ids = new Set<string>()
    if (result?.plaque) {
      ids.add('floss')
      ids.add('interdental')
    }
    if (bleeding) {
      ids.add('gum_paste')
      ids.add('soft_brush')
    }
    if (sensitivity) ids.add('sensitive_paste')
    if (braces) ids.add('interdental')
    if (result?.color === 'yellow') ids.add('mouthwash')
    return Array.from(ids)
  }, [bleeding, braces, result?.color, result?.plaque, sensitivity])

  const onPick = async (f: File | null) => {
    setFile(f)
    setResult(null)
    setAnalyzeError(null)
    setPain(false)
    setBleeding(false)
    setSensitivity(false)
    setBraces(false)
    if (!f) {
      setPreviewUrl(null)
      return
    }
    const url = await fileToDataUrl(f)
    setPreviewUrl(url)
  }

  const onAnalyze = async () => {
    if (!file || !previewUrl) return
    setLoading(true)
    setAnalyzeError(null)
    try {
      if (aiConfig && !aiConfig.hasApiKey) {
        throw new Error('missing_api_key')
      }
      if (aiConfig && aiConfig.hasApiKey && !aiConfig.apiKeyFormatOk) {
        throw new Error('invalid_api_key_format')
      }
      const contextAge =
        accountType === 'parent'
          ? (childProfiles[0]?.age ?? null)
          : accountType === 'adult'
            ? (adultAge ?? null)
            : null
      const res = await analyzeTeethPhoto({
        language,
        imageDataUrl: previewUrl,
        context: {
          age: contextAge,
          pain,
          bleeding,
          sensitivity,
          braces,
        },
      })
      const mapped = {
        score: res.cleanliness_score,
        color: res.color_assessment,
        plaque: res.plaque_visible,
        recommendations: res.recommendations,
        positive: res.positive_note,
        disclaimer: res.disclaimer,
      }
      setResult(mapped)
      addAiScan({
        photoUrl: previewUrl,
        cleanlinessScore: mapped.score,
        plaqueVisible: mapped.plaque,
        colorAssessment: mapped.color,
        recommendations: mapped.recommendations,
        positiveNote: mapped.positive,
        disclaimer: mapped.disclaimer,
        createdAt: new Date().toISOString(),
      })
    } catch (e) {
      const msg = String((e as { message?: unknown } | null)?.message ?? e ?? 'ai_error')
      const lower = msg.toLowerCase()
      if (lower.includes('invalid_api_key')) {
        setAnalyzeError('AI ключ невалидный (Anthropic не принял ключ). Проверь, что ключ начинается с sk-ant- и полностью скопирован. После замены перезапусти AI сервер.')
      } else if (lower.includes('invalid_api_key_format')) {
        setAnalyzeError('AI ключ в неправильном формате. Нужен ANTHROPIC_API_KEY=sk-ant-... (без "Bearer").')
      } else if (lower.includes('missing_api_key')) {
        setAnalyzeError('AI ключ не задан. Добавь ANTHROPIC_API_KEY в .env.local рядом с server/ (или в переменные окружения) и перезапусти AI сервер.')
      } else if (lower.includes('ai_backend_unreachable')) {
        setAnalyzeError('AI сервер недоступен. Проверь, что запущен npm run dev:api и что /api/health открывается.')
      } else if (lower.includes('anthropic_error')) {
        setAnalyzeError('AI временно недоступен. Попробуй ещё раз через минуту.')
      } else {
        setAnalyzeError(msg)
      }
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-3">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-extrabold text-slate-900">{t(language, 'scan.title')}</div>
            <div className="mt-2 text-xs font-semibold text-slate-600">{t(language, 'scan.hint')}</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-extrabold text-slate-700">
              AI • SmartSmile
            </div>
            <div
              className={[
                'rounded-2xl border px-3 py-2 text-[11px] font-extrabold',
                aiConfig
                  ? aiConfig.hasApiKey
                    ? aiConfig.apiKeyFormatOk
                      ? 'border-emerald-200 bg-emerald-500/10 text-emerald-800'
                      : 'border-rose-200 bg-rose-500/10 text-rose-900'
                    : 'border-amber-200 bg-amber-500/10 text-amber-900'
                  : 'border-slate-200 bg-white/70 text-slate-700',
              ].join(' ')}
            >
              {aiConfig
                ? aiConfig.hasApiKey
                  ? aiConfig.apiKeyFormatOk
                    ? aiReadyLabel
                    : `Ключ: формат ошибочный (${aiConfig.apiKeyLength})`
                  : 'AI ключ не задан'
                : aiConfigError
                  ? 'AI offline'
                  : 'AI…'}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <label className="block">
            <input
              className="hidden"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
            <div className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-500/10 to-orange-500/10 px-4 text-sm font-extrabold text-slate-900 hover:from-emerald-500/15 hover:to-orange-500/15">
              <Upload size={18} />
              {t(language, 'scan.pickPhoto')}
            </div>
          </label>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-3xl border border-slate-200 bg-white/60 p-3">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-slate-500" />
          <div className="text-xs font-semibold text-slate-600">{t(language, 'scan.disclaimer')}</div>
        </div>
      </Card>

      {previewUrl ? (
        <Card>
          <div className="overflow-hidden rounded-3xl border border-slate-200">
            <img src={previewUrl} alt="Preview" className="h-64 w-full object-cover" />
          </div>
          <div className="mt-3 grid gap-2">
            <div className="text-xs font-extrabold text-slate-700">{symptomTitle}</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPain((v) => !v)}
                className={[
                  'h-10 rounded-2xl border px-3 text-xs font-extrabold',
                  pain ? 'border-rose-300 bg-rose-300/25 text-rose-800' : 'border-slate-200 bg-white/70 text-slate-700',
                ].join(' ')}
              >
                {painLabel}
              </button>
              <button
                type="button"
                onClick={() => setBleeding((v) => !v)}
                className={[
                  'h-10 rounded-2xl border px-3 text-xs font-extrabold',
                  bleeding ? 'border-rose-300 bg-rose-300/25 text-rose-800' : 'border-slate-200 bg-white/70 text-slate-700',
                ].join(' ')}
              >
                {bleedingLabel}
              </button>
              <button
                type="button"
                onClick={() => setSensitivity((v) => !v)}
                className={[
                  'h-10 rounded-2xl border px-3 text-xs font-extrabold',
                  sensitivity ? 'border-amber-300 bg-amber-300/25 text-amber-900' : 'border-slate-200 bg-white/70 text-slate-700',
                ].join(' ')}
              >
                {sensitivityLabel}
              </button>
              <button
                type="button"
                onClick={() => setBraces((v) => !v)}
                className={[
                  'h-10 rounded-2xl border px-3 text-xs font-extrabold',
                  braces ? 'border-sky-300 bg-sky-300/25 text-sky-900' : 'border-slate-200 bg-white/70 text-slate-700',
                ].join(' ')}
              >
                {bracesLabel}
              </button>
            </div>
          </div>
          <div className="mt-3">
            <Button fullWidth onClick={onAnalyze} disabled={loading}>
              {loading ? t(language, 'common.loading') : t(language, 'common.analyze')}
            </Button>
          </div>
          {analyzeError ? (
            <div className="mt-3 rounded-3xl border border-rose-200 bg-rose-500/10 px-3 py-3 text-xs font-semibold text-rose-900">
              {analyzeError}
            </div>
          ) : null}
        </Card>
      ) : null}

      {result ? (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-slate-900">Результат</div>
            <div className={['text-xl font-extrabold', scoreColor].join(' ')}>{result.score}%</div>
          </div>

          <div className="mt-3 grid gap-2">
            {result.recommendations.slice(0, 3).map((r) => (
              <div key={r} className="flex items-start gap-2 rounded-3xl border border-slate-200 bg-white/70 p-3">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                <div className="text-sm font-semibold text-slate-800">{r}</div>
              </div>
            ))}
          </div>

          {suggestedProductIds.length ? (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-extrabold text-slate-700">{productsTitle}</div>
                <div className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-[11px] font-extrabold text-slate-700">
                  {balanceLabel}: 🪙 {dentCoins}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {suggestedProductIds
                  .map((id) => SHOP_ITEMS.find((x) => x.id === id))
                  .filter(Boolean)
                  .slice(0, 4)
                  .map((it) => {
                    const item = it!
                    const title = language === 'kz' ? item.titleKz : item.titleRu
                    const subtitle = language === 'kz' ? item.subtitleKz : item.subtitleRu
                    const owned = ownedShopItems[item.id] ?? 0
                    const canBuy = dentCoins >= item.price
                    const missing = Math.max(0, item.price - dentCoins)
                    return (
                      <div key={item.id} className="rounded-3xl border border-slate-200 bg-white/70 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-slate-900">
                              <span className="mr-1">{item.emoji}</span>
                              {title}
                            </div>
                            <div className="mt-0.5 text-[11px] font-semibold text-slate-600">{subtitle}</div>
                          </div>
                          {owned ? (
                            <div className="shrink-0 rounded-2xl border border-emerald-200 bg-emerald-500/10 px-2 py-1 text-[11px] font-extrabold text-emerald-800">
                              ×{owned}
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="text-xs font-extrabold text-slate-900">🪙 {item.price}</div>
                          <Button
                            variant="ghost"
                            className="h-9 rounded-2xl px-3 text-xs"
                            disabled={!canBuy}
                            onClick={() => buyShopItem(item.id)}
                          >
                            {canBuy ? buyLabel : `-${missing}`}
                          </Button>
                        </div>

                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 block text-[11px] font-extrabold text-emerald-700 hover:text-emerald-800"
                          >
                            {openLabel}
                          </a>
                        ) : null}
                      </div>
                    )
                  })}
              </div>
            </div>
          ) : null}

          <div className="mt-3 text-sm font-semibold text-slate-800">{result.positive}</div>
          <div className="mt-2 text-xs font-semibold text-slate-500">{result.disclaimer}</div>
        </Card>
      ) : null}
    </div>
  )
}
