import { motion, useInView, useMotionValue, useSpring, useTransform, type HTMLMotionProps } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'

const ease = [0.16, 1, 0.3, 1] as const

export function Reveal({ children, delay = 0, y = 18, className, once = true, ...rest }: { children: ReactNode; delay?: number; y?: number; className?: string; once?: boolean } & HTMLMotionProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once, margin: '-10% 0px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.9, ease, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

export function Stagger({ children, className, gap = 0.06 }: { children: ReactNode; className?: string; gap?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-10% 0px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  )
}

export const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease } },
}

export function Item({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  )
}

export function Counter({ value, format = (v) => Math.round(v).toLocaleString('en'), className }: { value: number; format?: (v: number) => string; className?: string }) {
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: 60, damping: 18, mass: 0.6 })
  const text = useTransform(spring, (v) => format(v))
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    mv.set(value)
  }, [value, mv])
  useEffect(() => {
    const unsub = text.on('change', (v) => {
      if (ref.current) ref.current.textContent = v
    })
    return unsub
  }, [text])
  return (
    <span ref={ref} className={className}>
      {format(0)}
    </span>
  )
}

export function Bar({ value, max, className, accent = 'bg-signal' }: { value: number; max: number; className?: string; accent?: string }) {
  const ratio = max === 0 ? 0 : Math.min(1, value / max)
  const over = max === 0 ? 0 : Math.max(0, value / max - 1)
  return (
    <div className={`relative h-2 w-full overflow-hidden rounded-full bg-ink-3 ${className ?? ''}`}>
      <motion.div
        className={`absolute inset-y-0 left-0 rounded-full ${accent}`}
        initial={{ width: 0 }}
        animate={{ width: `${ratio * 100}%` }}
        transition={{ duration: 1.2, ease }}
      />
      {over > 0 && (
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gold/70 mix-blend-screen"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(1, over) * 100}%` }}
          transition={{ duration: 1.2, ease, delay: 0.3 }}
        />
      )}
    </div>
  )
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.main
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.55, ease }}
    >
      {children}
    </motion.main>
  )
}

export { ease }
