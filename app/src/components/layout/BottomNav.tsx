import { History, House, ScanEye, Timer, User } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { t } from '../../lib/i18n'

const itemBase =
  'flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold text-slate-600'

export function BottomNav() {
  const language = useStore((s) => s.language)
  const accountType = useStore((s) => s.accountType)
  const adultAge = useStore((s) => s.age)

  const showKidTimer = accountType !== 'adult' || (typeof adultAge !== 'number' ? true : adultAge < 12)
  const timerTo = showKidTimer ? '/timer?kid=1' : '/timer'

  const items = [
    { id: 'home', to: '/', label: t(language, 'nav.home'), Icon: House },
    { id: 'timer', to: timerTo, label: t(language, 'nav.timer'), Icon: Timer },
    { id: 'scan', to: '/scan', label: t(language, 'nav.scan'), Icon: ScanEye },
    { id: 'history', to: '/history', label: t(language, 'nav.history'), Icon: History },
    { id: 'profile', to: '/profile', label: t(language, 'nav.profile'), Icon: User },
  ] as const

  return (
    <nav className="sticky bottom-0 z-10 border-t border-slate-200/70 bg-white/80 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <div className="flex items-stretch gap-2">
        {items.map(({ id, to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [
                itemBase,
                isActive
                  ? 'bg-gradient-to-r from-emerald-500/15 to-orange-500/15 text-slate-900 ring-1 ring-emerald-500/25'
                  : 'hover:bg-slate-900/5',
              ].join(' ')
            }
          >
            <Icon
              size={18}
              className={
                id === 'timer'
                  ? 'text-emerald-600'
                  : id === 'scan'
                    ? 'text-orange-500'
                    : id === 'history'
                      ? 'text-sky-600'
                      : id === 'profile'
                        ? 'text-violet-600'
                        : 'text-slate-700'
              }
            />
            <span className="leading-none">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
