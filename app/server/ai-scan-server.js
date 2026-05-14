import http from 'node:http'
import https from 'node:https'
import crypto from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { URL, fileURLToPath } from 'node:url'

const ENV_OVERRIDE_KEYS = new Set([
  'AI_SCAN_PORT',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_KEY',
  'ANTHROPIC_MODEL',
  'CLAUDE_MODEL',
])

function loadEnvFile(path) {
  if (!existsSync(path)) return
  const raw = readFileSync(path, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let val = trimmed.slice(idx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (ENV_OVERRIDE_KEYS.has(key) || !process.env[key]) process.env[key] = val
  }
}

function loadEnv() {
  const cwdBase = `file://${process.cwd()}/`
  const parentBase = `file://${new URL('..', cwdBase).pathname}/`
  const scriptDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const scriptBase = `file://${scriptDir}/`
  const scriptParentBase = `file://${path.resolve(scriptDir, '..')}/`
  const candidates = [
    new URL('./.env.local', scriptBase).pathname,
    new URL('./.env', scriptBase).pathname,
    new URL('./.env.local', scriptParentBase).pathname,
    new URL('./.env', scriptParentBase).pathname,
    new URL('./.env.local', cwdBase).pathname,
    new URL('./.env', cwdBase).pathname,
    new URL('./.env.local', parentBase).pathname,
    new URL('./.env', parentBase).pathname,
  ]
  for (const p of candidates) loadEnvFile(p)
}

loadEnv()

const PORT = Number(process.env.AI_SCAN_PORT ?? process.env.PORT ?? 8811)
const DIST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')

function contentTypeForPath(p) {
  const ext = path.extname(p).toLowerCase()
  if (ext === '.html') return 'text/html; charset=utf-8'
  if (ext === '.js') return 'application/javascript; charset=utf-8'
  if (ext === '.css') return 'text/css; charset=utf-8'
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.ico') return 'image/x-icon'
  if (ext === '.txt') return 'text/plain; charset=utf-8'
  if (ext === '.webmanifest') return 'application/manifest+json; charset=utf-8'
  return 'application/octet-stream'
}

function safeJoinDist(urlPathname) {
  const decoded = decodeURIComponent(urlPathname)
  const rel = decoded.startsWith('/') ? decoded.slice(1) : decoded
  const safeRel = rel.replaceAll('\0', '')
  const filePath = path.resolve(DIST_DIR, safeRel)
  const distResolved = path.resolve(DIST_DIR)
  if (!filePath.startsWith(distResolved + path.sep) && filePath !== distResolved) return null
  return filePath
}

function sendFile(res, filePath) {
  const st = statSync(filePath)
  res.writeHead(200, {
    'content-type': contentTypeForPath(filePath),
    'content-length': st.size,
    'cache-control': filePath.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  createReadStream(filePath).pipe(res)
}

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 15_000_000) {
        reject(new Error('payload_too_large'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function safeParseJson(str) {
  try {
    return { ok: true, value: JSON.parse(str) }
  } catch {
    return { ok: false, value: null }
  }
}

function extractDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') throw new Error('bad_image')
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/)
  if (!m) throw new Error('bad_image')
  return { mediaType: m[1], base64: m[2] }
}

function clampInt(v, min, max) {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.round(n)))
}

function normalizeColor(v) {
  if (v === 'white' || v === 'yellow' || v === 'gray') return v
  return 'gray'
}

function normalizeBool(v) {
  return Boolean(v)
}

function normalizeRecommendations(v, fallback) {
  if (!Array.isArray(v)) return fallback
  const out = v.map((x) => String(x).trim()).filter(Boolean).slice(0, 6)
  return out.length ? out : fallback
}

function normalizeText(v, fallback) {
  const s = String(v ?? '').trim()
  return s ? s.slice(0, 800) : fallback
}

function isNonEmptyStringArray(v, minLen) {
  if (!Array.isArray(v)) return false
  const out = v.map((x) => String(x).trim()).filter(Boolean)
  return out.length >= minLen
}

const AI_SCAN_SYSTEM = `
Ты — SmartSmile AI. Твоя задача — сделать БЕЗОПАСНЫЙ, ОСТОРОЖНЫЙ, НЕ ДИАГНОСТИЧЕСКИЙ скрининг по одному фото зубов.
Нельзя ставить диагнозы, нельзя писать с уверенностью, нельзя придумывать детали, которых не видно.
Если качество фото недостаточное, прямо укажи это в рекомендациях и держи оценку более нейтральной.

Правила безопасности:
- Никогда не говори «у вас кариес/гингивит/пародонтит». Вместо этого: «возможные признаки / риск может быть выше» и совет осмотра у стоматолога при необходимости.
- Упоминай только то, что реально видно: налёт/камень-подобные отложения, изменение цвета, явные тёмные участки/полости (только если очевидно), состояние дёсен (только если чётко видно).
- Если не видно — пиши «не могу оценить по фото».
- Рекомендации только гигиенические и поведенческие: чистка, межзубная очистка, паста с фтором по возрасту, питание, повторный скан, когда стоит обратиться к стоматологу.
- Тон: «как заботливый стоматолог»: конкретно, спокойно, без запугивания, без сложной терминологии.

Язык ответа:
- Если language=ru — только русский.
- Если language=kz — только казахский.
- Не используй английский.

Формат:
- Верни ровно валидный JSON по запрошенной схеме. Без markdown и без лишнего текста.
`.trim()

function buildUserPrompt(payload) {
  const language = payload.language === 'kz' ? 'kz' : 'ru'
  const ctx = payload.context && typeof payload.context === 'object' ? payload.context : {}
  const age = typeof ctx.age === 'number' ? ctx.age : null
  const braces = Boolean(ctx.braces ?? false)
  const pain = Boolean(ctx.pain ?? false)
  const bleeding = Boolean(ctx.bleeding ?? false)
  const sensitivity = Boolean(ctx.sensitivity ?? false)
  const badBreath = Boolean(ctx.badBreath ?? false)
  const note = typeof ctx.note === 'string' ? ctx.note.slice(0, 220) : ''

  const ru = `
Задача: дать первичный скрининг (не диагноз) по одному фото зубов.
Язык ответа: русский (НЕ английский).

Контекст:
- Возраст: ${age ?? 'не указан'}
- Брекеты/элайнеры: ${braces ? 'да' : 'нет'}
- Есть боль: ${pain ? 'да' : 'нет'}
- Есть кровоточивость: ${bleeding ? 'да' : 'нет'}
- Есть чувствительность: ${sensitivity ? 'да' : 'нет'}
- Есть неприятный запах: ${badBreath ? 'да' : 'нет'}
- Примечание: ${note || '—'}

Алгоритм (внутренний, но используйте для решения):
1) Сначала оцените пригодность фото: фокус/свет/видимость зубных поверхностей/дёсен. Если плохо — отметьте в рекомендациях и уменьшите уверенность в выводах.
2) Оцените видимые признаки:
   - Налёт (мягкий): матовый/жёлтоватый/липкий вид на поверхности.
   - Камень (твердый): плотные отложения у десневого края (если видно).
   - Цвет/пигментация: равномерное пожелтение vs локальные тёмные пятна.
   - Дёсны: покраснение/отёк/кровь (только если чётко видно).
   - Очевидные полости/сколы: только если явно присутствуют.
3) Переведите наблюдения в простую оценку чистоты 0–100:
   - 85–100: чисто, мало видимого налёта
   - 60–84: средне, возможен налёт/пигментация
   - 0–59: заметный налёт/отложения или плохое фото
4) Сформируйте 3–6 рекомендаций:
   - Всегда: 2 минуты, зоны по 30 сек; мягкая щётка; паста с фтором по возрасту; межзубная очистка.
   - Если брекеты: ершики/ирригатор, акцент на линии брекетов.
   - Если риск воспаления дёсен или кровоточивость: мягче щётка, угол 45°, не травмировать; визит к стоматологу при стойких симптомах.
   - Если возможна пигментация/налёт: уменьшить сладкие напитки/перекусы, полоскание водой после еды, контроль через 7 дней.
   - Стиль: 1 предложение на рекомендацию, без «воды», начинайте с глагола (например: «Почистите…», «Добавьте…», «Сделайте…»).
5) В конце: позитивная фраза + дисклеймер (не диагноз).

Жёсткие ограничения:
- Никаких диагнозов, только "возможные признаки/риск".
- Если что-то не видно, пишите "не могу оценить по фото".
- Не придумывайте наличие дырок/кариеса/воспаления если это не очевидно.

Верните строго JSON (без markdown) с ключами:
{
  "cleanliness_score": number (0-100 integer),
  "plaque_visible": boolean,
  "color_assessment": "white" | "yellow" | "gray",
  "recommendations": string[] (3-6),
  "positive_note": string,
  "disclaimer": string
}
`.trim()

  const kz = `
Міндет: бір фото бойынша бастапқы скрининг (диагноз емес) жасау.
Жауап тілі: қазақ тілі (ағылшынша емес).

Контекст:
- Жасы: ${age ?? 'көрсетілмеген'}
- Брекет/элайнер: ${braces ? 'иә' : 'жоқ'}
- Ауыру бар: ${pain ? 'иә' : 'жоқ'}
- Қан кету бар: ${bleeding ? 'иә' : 'жоқ'}
- Сезімталдық бар: ${sensitivity ? 'иә' : 'жоқ'}
- Жағымсыз иіс бар: ${badBreath ? 'иә' : 'жоқ'}
- Ескерту: ${note || '—'}

Алгоритм:
1) Фото сапасын бағалаңыз (фокус/жарық/тістер мен қызыл иек көрінуі). Егер сапа нашар болса, оны ұсыныстарда айтыңыз және қорытындыны сақ жасаңыз.
2) Көрінетін белгілер:
   - Жұмсақ қақ: күңгірт/сарғыш қабат.
   - Тіс тасына ұқсас: қызыл иек жиегінде қатты шөгінді (көрінсе).
   - Түс: біркелкі сарғаю vs жергілікті қара дақ.
   - Қызыл иек: қызару/ісіну/қан (тек анық көрінсе).
   - Айқын ойық/сыну: тек анық болса.
3) Тазалық бағасы 0–100:
   - 85–100: таза
   - 60–84: орташа
   - 0–59: қақ/шөгінді айқын немесе фото сапасы нашар
4) 3–6 ұсыныс:
   - Әрқашан: 2 минут; әр аймаққа 30 сек; жұмсақ щетка; жасқа сай фторлы паста; тісаралық тазалау.
   - Брекет болса: ершік/ирригатор, брекет сызығы.
   - Қызыл иек қаупі/қан кету болса: жұмсақ тазалау, 45° бұрыш, ұзақ симптом болса дәрігерге бару.
   - Қақ/пигментация болса: тәтті ішімдік/тіске жабыса беретін тәттіні азайту, тамақтан кейін ауызды сумен шайу, 7 күннен кейін қайта скан.
   - Стиль: әр ұсыныс 1 сөйлем, нақты және қысқа болсын.
5) Соңында: позитив + дисклеймер (диагноз емес).

Қатаң шектеулер:
- Диагноз қоймаңыз, тек "мүмкін белгі/қауіп" деңіз.
- Көрінбесе: "фото бойынша бағалай алмаймын".
- Айқын емес нәрсені ойлап таппаңыз.

Тек JSON қайтарыңыз (markdown жоқ):
{
  "cleanliness_score": number (0-100 integer),
  "plaque_visible": boolean,
  "color_assessment": "white" | "yellow" | "gray",
  "recommendations": string[] (3-6),
  "positive_note": string,
  "disclaimer": string
}
`.trim()

  return language === 'kz' ? kz : ru
}

async function callAnthropic({ apiKey, model, mediaType, base64, payload }) {
  const prompt = buildUserPrompt(payload)
  const body = {
    model,
    max_tokens: 750,
    temperature: 0.2,
    system: AI_SCAN_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  }

  const jsonResp = await new Promise((resolve, reject) => {
    const req = https.request(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        timeout: 45_000,
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
          if (data.length > 8_000_000) {
            reject(new Error('anthropic_response_too_large'))
            req.destroy()
          }
        })
        res.on('end', () => {
          const parsed = safeParseJson(data)
          if (!parsed.ok) return reject(new Error('anthropic_bad_json'))
          const status = Number(res.statusCode ?? 0)
          if (status < 200 || status >= 300) {
            const msg = parsed.value?.error?.message ?? `anthropic_error_${status || 'unknown'}`
            return reject(new Error(String(msg)))
          }
          resolve(parsed.value)
        })
      },
    )
    req.on('timeout', () => {
      reject(new Error('anthropic_timeout'))
      req.destroy()
    })
    req.on('error', reject)
    req.write(JSON.stringify(body))
    req.end()
  })

  const content = Array.isArray(jsonResp?.content) ? jsonResp.content : []
  const text = content.find((c) => c?.type === 'text')?.text
  if (typeof text !== 'string') throw new Error('bad_model_output')
  return text
}

async function callAnthropicPing({ apiKey, model }) {
  const body = {
    model,
    max_tokens: 16,
    temperature: 0,
    system: 'Return a single word: OK.',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }],
  }

  const jsonResp = await new Promise((resolve, reject) => {
    const req = https.request(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        timeout: 20_000,
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
          if (data.length > 2_000_000) {
            reject(new Error('anthropic_response_too_large'))
            req.destroy()
          }
        })
        res.on('end', () => {
          const parsed = safeParseJson(data)
          if (!parsed.ok) return reject(new Error('anthropic_bad_json'))
          const status = Number(res.statusCode ?? 0)
          if (status < 200 || status >= 300) {
            const msg = parsed.value?.error?.message ?? `anthropic_error_${status || 'unknown'}`
            return reject(new Error(String(msg)))
          }
          resolve(parsed.value)
        })
      },
    )
    req.on('timeout', () => {
      reject(new Error('anthropic_timeout'))
      req.destroy()
    })
    req.on('error', reject)
    req.write(JSON.stringify(body))
    req.end()
  })

  const content = Array.isArray(jsonResp?.content) ? jsonResp.content : []
  const text = content.find((c) => c?.type === 'text')?.text
  if (typeof text !== 'string') throw new Error('bad_model_output')
  return text
}

function parseModelJson(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  const slice = text.slice(start, end + 1)
  const parsed = safeParseJson(slice)
  return parsed.ok ? parsed.value : null
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) return json(res, 404, { error: 'not_found' })
    const u = new URL(req.url, 'http://localhost')

    if (req.method === 'OPTIONS') return json(res, 200, { ok: true })

    if (req.method === 'GET' && u.pathname === '/api/health') {
      return json(res, 200, { ok: true })
    }

    if (req.method === 'GET' && u.pathname === '/api/config') {
      let apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY || ''
      apiKey = String(apiKey).trim()
      if (apiKey.toLowerCase().startsWith('bearer ')) apiKey = apiKey.slice(7).trim()
      const hasApiKey = Boolean(apiKey)
      const apiKeyFormatOk = hasApiKey ? apiKey.startsWith('sk-ant-') : false
      const apiKeyLength = hasApiKey ? apiKey.length : 0
      const apiKeyFingerprint = hasApiKey ? crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 12) : null
      const model = process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307'
      return json(res, 200, { ok: true, hasApiKey, apiKeyFormatOk, apiKeyLength, apiKeyFingerprint, model })
    }

    if (req.method === 'POST' && u.pathname === '/api/ai/ping') {
      let apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY
      if (!apiKey) return json(res, 501, { error: 'missing_api_key' })
      apiKey = String(apiKey).trim()
      if (apiKey.toLowerCase().startsWith('bearer ')) apiKey = apiKey.slice(7).trim()
      if (!apiKey.startsWith('sk-ant-')) return json(res, 400, { error: 'invalid_api_key_format' })

      const raw = await readBody(req)
      const parsed = safeParseJson(raw)
      const payload = parsed.ok ? (parsed.value ?? {}) : {}
      const model =
        (typeof payload?.model === 'string' ? payload.model : null) ||
        process.env.ANTHROPIC_MODEL ||
        process.env.CLAUDE_MODEL ||
        'claude-3-haiku-20240307'

      try {
        const txt = await callAnthropicPing({ apiKey, model })
        return json(res, 200, { ok: true, model, text: String(txt).slice(0, 60) })
      } catch (e) {
        const msg = String(e?.message ?? e)
        if (msg.toLowerCase().includes('invalid x-api-key')) return json(res, 502, { error: 'invalid_api_key' })
        return json(res, 502, { error: 'anthropic_error', message: msg.slice(0, 300) })
      }
    }

    if (req.method === 'POST' && u.pathname === '/api/ai/scan') {
      let apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY
      if (!apiKey) return json(res, 501, { error: 'missing_api_key' })
      apiKey = String(apiKey).trim()
      if (apiKey.toLowerCase().startsWith('bearer ')) apiKey = apiKey.slice(7).trim()
      if (!apiKey.startsWith('sk-ant-')) return json(res, 400, { error: 'invalid_api_key_format' })

      const raw = await readBody(req)
      const parsed = safeParseJson(raw)
      if (!parsed.ok) return json(res, 400, { error: 'bad_json' })

      const payload = parsed.value ?? {}
      const imageDataUrl = payload.imageDataUrl
      const { mediaType, base64 } = extractDataUrl(imageDataUrl)

      const model = process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307'
      let outText = ''
      try {
        outText = await callAnthropic({ apiKey, model, mediaType, base64, payload })
      } catch (e) {
        const msg = String(e?.message ?? e)
        if (msg.toLowerCase().includes('invalid x-api-key')) return json(res, 502, { error: 'invalid_api_key' })
        if (msg === 'anthropic_timeout') return json(res, 504, { error: 'anthropic_timeout' })
        if (msg === 'anthropic_bad_json') return json(res, 502, { error: 'anthropic_bad_json' })
        return json(res, 502, { error: 'anthropic_error', message: msg.slice(0, 300) })
      }
      const out = parseModelJson(outText)
      if (!out) return json(res, 502, { error: 'invalid_model_json' })

      const lang = payload.language === 'kz' ? 'kz' : 'ru'
      if (!isNonEmptyStringArray(out.recommendations, 3)) return json(res, 502, { error: 'invalid_model_output' })

      const normalized = {
        cleanliness_score: clampInt(out.cleanliness_score, 0, 100),
        plaque_visible: normalizeBool(out.plaque_visible),
        color_assessment: normalizeColor(out.color_assessment),
        recommendations: out.recommendations.map((x) => String(x).trim()).filter(Boolean).slice(0, 6),
        positive_note: normalizeText(out.positive_note, lang === 'kz' ? 'Жақсы жұмыс!' : 'Отличная работа!'),
        disclaimer: normalizeText(
          out.disclaimer,
          lang === 'kz'
            ? 'Бұл медициналық диагноз емес. Ұсыныстар тек фотоға негізделген.'
            : 'Это не медицинский диагноз. Рекомендации основаны только на фото.',
        ),
      }

      return json(res, 200, normalized)
    }

    if (req.method === 'GET' && !u.pathname.startsWith('/api/')) {
      const distExists = existsSync(DIST_DIR) && existsSync(path.join(DIST_DIR, 'index.html'))
      if (!distExists) return json(res, 404, { error: 'not_found' })

      const filePath = safeJoinDist(u.pathname)
      if (!filePath) return json(res, 404, { error: 'not_found' })

      if (existsSync(filePath) && statSync(filePath).isFile()) {
        return sendFile(res, filePath)
      }

      return sendFile(res, path.join(DIST_DIR, 'index.html'))
    }

    return json(res, 404, { error: 'not_found' })
  } catch (e) {
    return json(res, 500, { error: 'server_error', message: String(e?.message ?? e).slice(0, 300) })
  }
})

server.listen(PORT, () => {
  console.log(`[ai-scan] listening on http://localhost:${PORT}`)
})
