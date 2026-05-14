import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { t } from '../../lib/i18n'
import type { AccountType, Language } from '../../store/useStore'
import { useStore } from '../../store/useStore'

type Step = 1 | 2 | 3

export function OnboardingPage() {
  const navigate = useNavigate()
  const language = useStore((s) => s.language)
  const setLanguage = useStore((s) => s.setLanguage)
  const completeOnboarding = useStore((s) => s.completeOnboarding)

  const [step, setStep] = useState<Step>(1)
  const [accountType, setAccountType] = useState<AccountType>('parent')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('Арайлым')
  const [age, setAge] = useState<string>('24')
  const [childName, setChildName] = useState('Арайлым')
  const [childAge, setChildAge] = useState<string>('7')
  const [mascotId, setMascotId] = useState<number>(1)
  const [goal, setGoal] = useState<'improve' | 'track_child' | 'work_patients'>('improve')

  const goalOptions = useMemo(() => {
    if (accountType === 'doctor') return [{ id: 'work_patients' as const, label: t(language, 'onboarding.step3.goal.work_patients') }]
    if (accountType === 'parent')
      return [{ id: 'track_child' as const, label: t(language, 'onboarding.step3.goal.track_child') }]
    return [{ id: 'improve' as const, label: t(language, 'onboarding.step3.goal.improve') }]
  }, [accountType, language])

  const onFinish = () => {
    const defaultName = accountType === 'doctor' ? 'Доктор' : 'Арайлым'
    completeOnboarding({
      accountType,
      displayName: displayName.trim() || defaultName,
      age: accountType === 'adult' ? Number(age || '0') || null : null,
      mascotId,
      goal,
      child:
        accountType === 'parent'
          ? {
              name: childName.trim() || 'Арайлым',
              age: Number(childAge || '0') || 6,
              mascotId,
            }
          : null,
    })
    navigate('/', { replace: true })
  }

  const langToggle = (
    <div className="flex items-center justify-end gap-2">
      {(['ru', 'kz'] as Language[]).map((lng) => (
        <button
          key={lng}
          onClick={() => setLanguage(lng)}
          className={[
            'rounded-xl border px-3 py-1 text-xs font-extrabold',
            language === lng ? 'border-emerald-300 bg-emerald-500/10 text-emerald-800' : 'border-slate-200 bg-white/60 text-slate-700 hover:bg-white',
          ].join(' ')}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  )

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 py-6">
      <div className="mb-4">{langToggle}</div>
      <div className="mb-3 text-lg font-extrabold text-slate-900">{t(language, 'onboarding.title')}</div>

      {step === 1 ? (
        <Card>
          <div className="mb-3 text-sm font-extrabold text-slate-900">{t(language, 'onboarding.step1.title')}</div>
          <div className="grid gap-2">
            {([
              { id: 'parent' as const, label: t(language, 'onboarding.step1.parent') },
              { id: 'adult' as const, label: t(language, 'onboarding.step1.adult') },
              { id: 'doctor' as const, label: t(language, 'onboarding.step1.doctor') },
            ] as const).map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  setAccountType(o.id)
                  setGoal(o.id === 'doctor' ? 'work_patients' : o.id === 'parent' ? 'track_child' : 'improve')
                }}
                className={[
                  'rounded-3xl border px-4 py-4 text-left',
                  accountType === o.id
                    ? 'border-emerald-300 bg-emerald-500/10 text-slate-900'
                    : 'border-slate-200 bg-white/70 text-slate-800 hover:bg-white',
                ].join(' ')}
              >
                <div className="text-sm font-extrabold">{o.label}</div>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <Button fullWidth onClick={() => setStep(2)}>
              {t(language, 'common.continue')}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <div className="mb-3 text-sm font-extrabold text-slate-900">{t(language, 'onboarding.step2.title')}</div>
          <div className="grid gap-3">
            <Input label={t(language, 'onboarding.step2.email')} value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input
              label={t(language, 'onboarding.step2.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                {t(language, 'common.back')}
              </Button>
              <Button onClick={() => setStep(3)}>{t(language, 'common.continue')}</Button>
            </div>
            <Button variant="ghost" onClick={() => setStep(3)}>
              {t(language, 'onboarding.step2.skip')}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <div className="mb-3 text-sm font-extrabold text-slate-900">{t(language, 'onboarding.step3.title')}</div>

          <div className="grid gap-3">
            <Input
              label={t(language, 'onboarding.step3.name')}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={accountType === 'doctor' ? 'Dr. Aibek' : 'Aruzhan'}
            />

            {accountType === 'adult' ? (
              <Input label={t(language, 'onboarding.step3.age')} inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
            ) : null}

            {accountType === 'parent' ? (
              <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white/70 p-3">
                <div className="text-xs font-extrabold text-slate-700">Ребёнок</div>
                <Input label={t(language, 'onboarding.step3.childName')} value={childName} onChange={(e) => setChildName(e.target.value)} />
                <Input
                  label={t(language, 'onboarding.step3.childAge')}
                  inputMode="numeric"
                  value={childAge}
                  onChange={(e) => setChildAge(e.target.value)}
                />
              </div>
            ) : null}

            <div className="rounded-3xl border border-slate-200 bg-white/70 p-3">
              <div className="mb-2 text-xs font-extrabold text-slate-700">Маскот</div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((id) => (
                  <motion.button
                    key={id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setMascotId(id)}
                    className={[
                      'rounded-3xl border px-3 py-3 text-center text-sm font-extrabold',
                      mascotId === id ? 'border-emerald-300 bg-emerald-500/10 text-slate-900' : 'border-slate-200 bg-white/60 text-slate-800 hover:bg-white',
                    ].join(' ')}
                  >
                    {id === 1 ? '🦷' : id === 2 ? '🪥' : '⭐'}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/70 p-3">
              <div className="mb-2 text-xs font-extrabold text-slate-700">{t(language, 'onboarding.step3.goal')}</div>
              <div className="grid gap-2">
                {goalOptions.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setGoal(o.id)}
                    className={[
                      'rounded-3xl border px-3 py-3 text-left text-sm font-extrabold',
                      goal === o.id ? 'border-emerald-300 bg-emerald-500/10 text-slate-900' : 'border-slate-200 bg-white/60 text-slate-800 hover:bg-white',
                    ].join(' ')}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setStep(2)}>
                {t(language, 'common.back')}
              </Button>
              <Button onClick={onFinish}>{t(language, 'common.ready')}</Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
