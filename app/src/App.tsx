import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { OnboardingPage } from './pages/Onboarding/OnboardingPage'
import { DashboardPage } from './pages/Dashboard/DashboardPage'
import { TimerPage } from './pages/Timer/TimerPage'
import { AiScanPage } from './pages/AIScan/AiScanPage'
import { HistoryPage } from './pages/History/HistoryPage'
import { SettingsPage } from './pages/Settings/SettingsPage'
import { DoctorDashboardPage } from './pages/DoctorDashboard/DoctorDashboardPage'
import { useStore } from './store/useStore'

function App() {
  const onboardingCompleted = useStore((s) => s.onboardingCompleted)
  const accountType = useStore((s) => s.accountType)
  const location = useLocation()
  const isOnboardingRoute = location.pathname.startsWith('/onboarding')
  const mustOnboard = !onboardingCompleted && !isOnboardingRoute

  return (
    <Routes>
      {mustOnboard ? <Route path="*" element={<Navigate to="/onboarding" replace />} /> : null}

      <Route path="/onboarding" element={<OnboardingPage />} />

      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/timer" element={<TimerPage />} />
        <Route path="/scan" element={<AiScanPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/profile" element={<SettingsPage />} />
        <Route path="/doctor" element={accountType === 'doctor' ? <DoctorDashboardPage /> : <Navigate to="/" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
