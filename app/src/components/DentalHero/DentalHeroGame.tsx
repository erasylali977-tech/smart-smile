import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import type { Language } from '../../store/useStore'
import SmartSmileUltimateGame from '../../SmartSmileUltimate-4.jsx'

export function DentalHeroGame({
  language,
  onComplete,
}: {
  language: Language
  onComplete: (payload: { startedAtISO: string; coinsEarned: number; durationSeconds: number }) => void
}) {
  const navigate = useNavigate()
  const [exitRequested, setExitRequested] = useState(false)
  const exitTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!exitRequested) return
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current)
    exitTimerRef.current = window.setTimeout(() => navigate('/'), 260)
    return () => {
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current)
    }
  }, [exitRequested, navigate])

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={exitRequested ? { opacity: 0, y: -12 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
      style={{ pointerEvents: exitRequested ? 'none' : 'auto' }}
    >
      <SmartSmileUltimateGame language={language} onComplete={onComplete} onExit={() => setExitRequested(true)} />
    </motion.div>
  )
}

