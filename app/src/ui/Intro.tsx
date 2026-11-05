import { useLayoutEffect, useRef, useState } from 'react'
import { gsap, reduced } from './scroll'

const KEY = 'allot:intro'
const first = typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(KEY) && !reduced

export const introDelay = first ? 2.1 : 0.15

export function Intro() {
  const ref = useRef<HTMLDivElement>(null)
  const [gone, setGone] = useState(!first)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || gone) return
    sessionStorage.setItem(KEY, '1')
    document.documentElement.style.overflow = 'hidden'
    const ctx = gsap.context(() => {
      const count = el.querySelector('[data-count]')!
      const n = { v: 0 }
      gsap
        .timeline({
          onComplete: () => {
            document.documentElement.style.overflow = ''
            setGone(true)
          },
        })
        .from('[data-stroke]', { strokeDashoffset: 120, duration: 1.1, ease: 'power3.inOut', stagger: 0.12 })
        .from('[data-word] span', { yPercent: 110, duration: 0.9, stagger: 0.04 }, 0.25)
        .to(n, { v: 100, duration: 1.4, ease: 'power2.inOut', onUpdate: () => (count.textContent = String(Math.round(n.v)).padStart(3, '0')) }, 0)
        .to('[data-inner]', { yPercent: -12, autoAlpha: 0, duration: 0.5, ease: 'power3.in' }, 1.5)
        .to(el, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'expo.inOut' }, 1.6)
    }, el)
    return () => ctx.revert()
  }, [gone])

  if (gone) return null
  return (
    <div ref={ref} className="fixed inset-0 z-[100] bg-ink" style={{ clipPath: 'inset(0 0 0% 0)' }}>
      <div data-inner className="flex h-full flex-col items-center justify-center">
        <svg viewBox="0 0 32 32" className="h-14 w-14 text-paper">
          <circle data-stroke cx="16" cy="16" r="15" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="120" />
          <path data-stroke d="M8 22 L16 8 L24 22" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeDasharray="120" />
          <path data-stroke d="M11.5 17.5 H20.5" stroke="var(--color-signal)" strokeWidth="1.2" strokeDasharray="120" />
        </svg>
        <p data-word className="display mt-5 overflow-hidden text-5xl">
          {'Allot'.split('').map((c, i) => (
            <span key={i} className="inline-block">
              {c}
            </span>
          ))}
        </p>
      </div>
      <span data-count className="mono absolute bottom-6 right-6 text-sm text-mute">
        000
      </span>
      <span className="mono absolute bottom-6 left-6 text-xs uppercase tracking-[0.2em] text-mute">Primary markets, settled by the chain</span>
    </div>
  )
}
