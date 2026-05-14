import { Flame, Coins, Camera, Play } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { MascotAnimated } from '../../components/MascotAnimated/MascotAnimated'
import { t } from '../../lib/i18n'
import { formatShortDate, toISODate } from '../../lib/date'
import { computeStreak, lastScan, maxStreak } from '../../lib/stats'
import { SHOP_ITEMS, useStore } from '../../store/useStore'

export function DashboardPage() {
  const navigate = useNavigate()
  const language = useStore((s) => s.language)
  const displayName = useStore((s) => s.displayName)
  const brushingSessions = useStore((s) => s.brushingSessions)
  const aiScans = useStore((s) => s.aiScans)
  const dentCoins = useStore((s) => s.dentCoins)
  const ownedShopItems = useStore((s) => s.ownedShopItems)
  const buyShopItem = useStore((s) => s.buyShopItem)
  const accountType = useStore((s) => s.accountType)
  const childProfiles = useStore((s) => s.childProfiles)
  const mascotId = useStore((s) => s.mascotId)
  const [shopExpanded, setShopExpanded] = useState(false)

  const streak = computeStreak(brushingSessions)
  const best = maxStreak(brushingSessions)
  const today = toISODate(new Date())
  const todayCount = brushingSessions.filter((s) => s.sessionDate === today).length
  const morningDone = todayCount >= 1
  const eveningDone = todayCount >= 2
  const scan = lastScan(aiScans)

  const nameForGreeting =
    accountType === 'parent' ? childProfiles[0]?.name ?? displayName : displayName
  const avatarMascot = accountType === 'parent' ? childProfiles[0]?.mascotId ?? 1 : mascotId ?? 1

  return (
    <div className="grid gap-3">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-slate-200 bg-white/70 shadow-[0_10px_26px_rgba(2,6,23,0.08)]">
              <div className="scale-[0.55]">
                <MascotAnimated mascotId={avatarMascot} intensity={0.9} />
              </div>
            </div>
            <div>
              <div className="text-base font-extrabold text-slate-900">{t(language, 'dashboard.greeting', { name: nameForGreeting || '—' })}</div>
              <div className="mt-0.5 text-xs font-semibold text-slate-600">
                {language === 'kz' ? 'Күн сайын 2 рет — 2 минуттан' : 'Каждый день 2 раза — по 2 минуты'}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-500/10 px-3 py-2 text-xs font-extrabold text-emerald-800">
            2×2
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Flame size={16} className="text-orange-500" />
            <span>{t(language, 'dashboard.streak')}</span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{streak}</div>
          <div className="mt-1 text-xs text-slate-500">Max: {best}</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Coins size={16} className="text-amber-500" />
            <span>{t(language, 'dashboard.coins')}</span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{dentCoins}</div>
        </Card>
      </div>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-slate-900">
              {language === 'kz' ? 'DentCoin дүкені' : 'Магазин за DentCoins'}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-600">
              {language === 'kz' ? 'Монетаға құрал-жабдық жина' : 'Собирай наборы и предметы за монетки'}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-extrabold text-slate-700">
              {language === 'kz' ? 'Баланс' : 'Баланс'}: 🪙 {dentCoins}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-extrabold text-slate-700">
              {language === 'kz' ? 'Инвентарь' : 'Инвентарь'}: {Object.values(ownedShopItems).reduce((a, b) => a + b, 0)}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {(shopExpanded ? SHOP_ITEMS : SHOP_ITEMS.slice(0, 4)).map((it) => {
            const title = language === 'kz' ? it.titleKz : it.titleRu
            const subtitle = language === 'kz' ? it.subtitleKz : it.subtitleRu
            const owned = ownedShopItems[it.id] ?? 0
            const canBuy = dentCoins >= it.price
            const missing = Math.max(0, it.price - dentCoins)
            return (
              <div key={it.id} className="rounded-3xl border border-slate-200 bg-white/70 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900">
                      <span className="mr-1">{it.emoji}</span>
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
                  <div className="text-xs font-extrabold text-slate-900">🪙 {it.price}</div>
                  <Button
                    variant="ghost"
                    className="h-9 rounded-2xl px-3 text-xs"
                    disabled={!canBuy}
                    onClick={() => buyShopItem(it.id)}
                  >
                    {canBuy ? (language === 'kz' ? 'Алу' : 'Купить') : `-${missing}`}
                  </Button>
                </div>

                {it.url ? (
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block text-[11px] font-extrabold text-emerald-700 hover:text-emerald-800"
                  >
                    {language === 'kz' ? 'Сілтеме' : 'Ссылка'}
                  </a>
                ) : null}
              </div>
            )
          })}
        </div>

        {SHOP_ITEMS.length > 4 ? (
          <div className="mt-3">
            <Button fullWidth variant="ghost" onClick={() => setShopExpanded((v) => !v)}>
              {shopExpanded ? (language === 'kz' ? 'Жасыру' : 'Скрыть') : language === 'kz' ? 'Барлығын көру' : 'Показать всё'}
            </Button>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-500/10 via-white/60 to-orange-500/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-slate-900">🦷 Игра чистки зубов</div>
              <div className="mt-1 text-xs font-semibold text-slate-600">2 минуты = 4 зоны = монетки. Победи микробов и собери комбо!</div>
            </div>
            <Button onClick={() => navigate('/timer?kid=1')}>
              <Play size={16} />
              Играть
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-slate-900">{t(language, 'dashboard.today')}</div>
            <div className="mt-2 flex gap-2">
              <div
                className={[
                  'rounded-2xl border px-3 py-2 text-xs font-semibold',
                  morningDone ? 'border-emerald-400 bg-emerald-400/15 text-emerald-800' : 'border-slate-200 bg-white/60 text-slate-600',
                ].join(' ')}
              >
                {t(language, 'dashboard.today.morning')}
              </div>
              <div
                className={[
                  'rounded-2xl border px-3 py-2 text-xs font-semibold',
                  eveningDone ? 'border-emerald-400 bg-emerald-400/15 text-emerald-800' : 'border-slate-200 bg-white/60 text-slate-600',
                ].join(' ')}
              >
                {t(language, 'dashboard.today.evening')}
              </div>
            </div>
          </div>
          <Button onClick={() => navigate('/timer?kid=1')}>
            <Play size={16} />
            {t(language, 'dashboard.start')}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-slate-900">{t(language, 'dashboard.lastScan')}</div>
            <div className="mt-1 text-xs text-slate-500">
              {scan ? `${formatShortDate(scan.createdAt.slice(0, 10), language)} • ${scan.cleanlinessScore}%` : '—'}
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate('/scan')}>
            <Camera size={16} />
            {t(language, 'dashboard.newScan')}
          </Button>
        </div>
        {scan?.photoUrl ? (
          <div className="mt-3 overflow-hidden rounded-3xl border border-slate-200">
            <img src={scan.photoUrl} alt="AI scan" className="h-40 w-full object-cover" />
          </div>
        ) : null}
      </Card>
    </div>
  )
}
