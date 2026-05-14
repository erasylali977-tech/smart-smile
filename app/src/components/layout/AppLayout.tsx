import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { useStore } from '../../store/useStore'
import { t } from '../../lib/i18n'

export function AppLayout() {
  const language = useStore((s) => s.language)
  const accountType = useStore((s) => s.accountType)
  const location = useLocation()
  const navigate = useNavigate()
  const immersive = location.pathname.startsWith('/timer')

  const title = (() => {
    if (location.pathname.startsWith('/timer')) return t(language, 'nav.timer')
    if (location.pathname.startsWith('/scan')) return t(language, 'nav.scan')
    if (location.pathname.startsWith('/history')) return t(language, 'nav.history')
    if (location.pathname.startsWith('/profile')) return t(language, 'nav.profile')
    if (location.pathname.startsWith('/doctor')) return t(language, 'doctor.title')
    return t(language, 'nav.home')
  })()

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col">
      {!immersive ? (
        <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold text-slate-900">{title}</div>
            {accountType === 'doctor' ? (
              <button
                className="rounded-xl border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                onClick={() => navigate('/doctor')}
              >
                {t(language, 'doctor.code')}
              </button>
            ) : null}
          </div>
        </header>
      ) : null}

      <main className={immersive ? 'flex-1' : 'flex-1 px-4 py-4'}>
        <Outlet />
      </main>

      {!immersive ? <BottomNav /> : null}
    </div>
  )
}
