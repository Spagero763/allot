import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useEffect, useRef, useState } from 'react'
import { CLUSTER } from '@/lib/config'
import { Curtain } from './Curtain'
import { Intro } from './Intro'
import { gsap, ScrollTrigger, SmoothScroll } from './scroll'

const links = [
  { to: '/', label: 'Offers' },
  { to: '/me', label: 'Portfolio' },
  { to: '/issue', label: 'Issue' },
  { to: '/developers', label: 'Developers' },
]

export function Shell() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const header = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = header.current
    if (!el) return
    const show = gsap.quickTo(el, 'yPercent', { duration: 0.5, ease: 'power3.out' })
    const st = ScrollTrigger.create({
      start: 120,
      onUpdate: (self) => show(self.direction === 1 && self.scroll() > 300 ? -100 : 0),
    })
    return () => st.kill()
  }, [])

  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="grain relative min-h-dvh">
      <SmoothScroll />
      <Intro />
      <Curtain />
      <header ref={header} className="fixed inset-x-0 top-0 z-40 border-b border-line bg-ink/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <NavLink to="/" className="group flex items-center gap-2">
            <Mark className="h-6 w-6 transition-transform duration-700 ease-out group-hover:rotate-[360deg]" />
            <span className="display text-2xl">Allot</span>
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'} className="relative rounded-full px-4 py-2 text-sm">
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-paper" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                    <span className={`relative transition-colors ${isActive ? 'text-ink' : 'text-paper-2 hover:text-paper'}`}>{l.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <WalletMultiButton />
            <button aria-label="menu" className="btn btn-ghost h-10 w-10 p-0 md:hidden" onClick={() => setOpen((v) => !v)}>
              <span className="relative block h-3 w-4">
                <span className={`absolute left-0 top-0 h-px w-4 bg-paper transition ${open ? 'translate-y-1.5 rotate-45' : ''}`} />
                <span className={`absolute bottom-0 left-0 h-px w-4 bg-paper transition ${open ? '-translate-y-1.5 -rotate-45' : ''}`} />
              </span>
            </button>
          </div>
        </div>
        <AnimatePresence>
          {open && (
            <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden border-t border-line md:hidden">
              <div className="flex flex-col px-4 py-3">
                {links.map((l, i) => (
                  <motion.div key={l.to} initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                    <NavLink to={l.to} end={l.to === '/'} className="display block py-2 text-4xl">
                      {l.label}
                    </NavLink>
                  </motion.div>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
      <div key={location.pathname} className="pt-16">
        <Outlet />
      </div>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-24 text-sm text-mute md:px-6">
        <div className="flex flex-col gap-3 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
          <span>Allot. Primary markets, settled by the chain.</span>
          <span className="mono flex items-center gap-2">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-mint" />
            {CLUSTER}
          </span>
        </div>
      </footer>
    </div>
  )
}

export function Mark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 22 L16 8 L24 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11.5 17.5 H20.5" stroke="var(--color-signal)" strokeWidth="1.5" />
    </svg>
  )
}
