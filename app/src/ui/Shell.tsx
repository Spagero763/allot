import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useState } from 'react'

const links = [
  { to: '/', label: 'Offers' },
  { to: '/me', label: 'Portfolio' },
  { to: '/issue', label: 'Issue' },
  { to: '/developers', label: 'Developers' },
]

export function Shell() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  return (
    <div className="grain relative min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <NavLink to="/" className="flex items-center gap-2">
            <Mark />
            <span className="display text-2xl">Allot</span>
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm transition ${isActive ? 'bg-paper text-ink' : 'text-paper-2 hover:text-paper'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <WalletMultiButton />
            <button aria-label="menu" className="btn btn-ghost h-10 w-10 p-0 md:hidden" onClick={() => setOpen((v) => !v)}>
              <span className="relative block h-3 w-4">
                <span className={`absolute left-0 top-0 h-px w-4 bg-paper transition ${open ? 'translate-y-1.5 rotate-45' : ''}`} />
                <span className={`absolute left-0 bottom-0 h-px w-4 bg-paper transition ${open ? '-translate-y-1.5 -rotate-45' : ''}`} />
              </span>
            </button>
          </div>
        </div>
        <AnimatePresence>
          {open && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-line md:hidden"
            >
              <div className="flex flex-col px-4 py-2">
                {links.map((l) => (
                  <NavLink key={l.to} to={l.to} end={l.to === '/'} onClick={() => setOpen(false)} className="py-3 text-lg">
                    {l.label}
                  </NavLink>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
      <AnimatePresence mode="wait">
        <div key={location.pathname}>
          <Outlet />
        </div>
      </AnimatePresence>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-20 text-sm text-mute md:px-6">
        <div className="flex flex-col gap-3 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
          <span>Allot. Primary markets, settled by the chain.</span>
          <span className="mono">devnet</span>
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
      <path d="M11.5 17.5 H20.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
