import { motion } from 'framer-motion'

type Props = {
  mascotId: number
  intensity?: number
}

export function MascotAnimated({ mascotId, intensity = 1 }: Props) {
  const emoji = mascotId === 1 ? '🦷' : mascotId === 2 ? '🪥' : '⭐'

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        animate={{ y: [0, -6 * intensity, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        className="select-none text-6xl"
      >
        {emoji}
      </motion.div>
      <motion.div
        className="absolute -bottom-3 h-3 w-20 rounded-full bg-slate-900/20 blur-[1px]"
        animate={{ scale: [1, 0.85, 1], opacity: [0.5, 0.3, 0.5] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
