import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { t } from '../../lib/i18n'
import type { Language } from '../../store/useStore'
import { useStore } from '../../store/useStore'

export function SettingsPage() {
  const navigate = useNavigate()
  const language = useStore((s) => s.language)
  const setLanguage = useStore((s) => s.setLanguage)
  const accountType = useStore((s) => s.accountType)
  const displayName = useStore((s) => s.displayName)
  const mascotId = useStore((s) => s.mascotId)
  const childProfiles = useStore((s) => s.childProfiles)
  const linkedClinicCode = useStore((s) => s.linkedClinicCode)
  const linkClinic = useStore((s) => s.linkClinic)
  const applyDemoProfile = useStore((s) => s.applyDemoProfile)
  const resetAllData = useStore((s) => s.resetAllData)
  const signOut = useStore((s) => s.signOut)

  const [clinicCodeInput, setClinicCodeInput] = useState(linkedClinicCode ?? '')

  const profile = useMemo(() => {
    if (accountType === 'parent') {
      const child = childProfiles[0] ?? null
      const name = child?.name || displayName || '—'
      const emoji = (child?.mascotId ?? 1) === 1 ? '🦷' : (child?.mascotId ?? 1) === 2 ? '🪥' : '⭐'
      const role = language === 'kz' ? 'Бала' : 'Ребёнок'
      const age = typeof child?.age === 'number' ? child.age : null
      return { name, emoji, role, age }
    }
    const emoji = (mascotId ?? 1) === 1 ? '🦷' : (mascotId ?? 1) === 2 ? '🪥' : '⭐'
    const role =
      accountType === 'doctor'
        ? language === 'kz'
          ? 'Стоматолог'
          : 'Стоматолог'
        : language === 'kz'
          ? 'Ересек'
          : 'Взрослый'
    return { name: displayName || '—', emoji, role, age: null }
  }, [accountType, childProfiles, displayName, language, mascotId])

  return (
    <div className="grid gap-3">
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-slate-200 bg-gradient-to-br from-emerald-500/10 via-white/70 to-orange-500/10 text-3xl shadow-[0_10px_26px_rgba(2,6,23,0.08)]">
            {profile.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold text-slate-900">{profile.name}</div>
            <div className="mt-0.5 flex items-center gap-2">
              <div className="rounded-xl border border-slate-200 bg-white/70 px-2 py-1 text-[11px] font-extrabold text-slate-700">{profile.role}</div>
              {typeof profile.age === 'number' ? (
                <div className="rounded-xl border border-slate-200 bg-white/70 px-2 py-1 text-[11px] font-extrabold text-slate-700">
                  {language === 'kz' ? `${profile.age} жас` : `${profile.age} лет`}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-2 text-xs font-semibold text-slate-600">{t(language, 'settings.language')}</div>
          <div className="flex gap-2">
            {(['ru', 'kz'] as Language[]).map((lng) => (
              <button
                key={lng}
                onClick={() => setLanguage(lng)}
                className={[
                  'rounded-2xl border px-3 py-2 text-xs font-extrabold',
                  language === lng ? 'border-emerald-300 bg-emerald-500/10 text-emerald-800' : 'border-slate-200 bg-white/60 text-slate-700 hover:bg-white',
                ].join(' ')}
              >
                {lng.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {accountType !== 'doctor' ? (
        <Card>
          <div className="text-sm font-extrabold text-slate-900">{t(language, 'settings.linkDoctor')}</div>
          <div className="mt-2 grid gap-2">
            <Input value={clinicCodeInput} onChange={(e) => setClinicCodeInput(e.target.value)} placeholder="ABC123" />
            <Button
              onClick={() => linkClinic(clinicCodeInput)}
              disabled={!clinicCodeInput.trim()}
              fullWidth
            >
              {t(language, 'common.save')}
            </Button>
            {linkedClinicCode ? <div className="text-xs font-semibold text-slate-500">Код: {linkedClinicCode}</div> : null}
          </div>
        </Card>
      ) : (
        <Card>
          <div className="text-sm font-extrabold text-slate-900">{t(language, 'doctor.title')}</div>
          <div className="mt-3">
            <Button fullWidth onClick={() => navigate('/doctor')}>
              Открыть кабинет
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <div className="text-sm font-extrabold text-slate-900">Демо-профиль</div>
        <div className="mt-2 text-xs font-semibold text-slate-600">Заполнит профиль и добавит немного данных для презентации.</div>
        <div className="mt-3">
          <Button fullWidth variant="secondary" onClick={() => applyDemoProfile()}>
            Заполнить демо
          </Button>
        </div>
      </Card>

      <Card>
        <div className="grid gap-2">
          <Button variant="secondary" fullWidth onClick={() => resetAllData()}>
            {t(language, 'settings.reset')}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => signOut()}>
            {t(language, 'settings.signout')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
