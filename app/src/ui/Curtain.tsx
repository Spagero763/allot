import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { gsap, reduced } from './scroll'

const titles: Record<string, string> = { '': 'Offers', o: 'The book', me: 'Portfolio', issue: 'Open a book', verify: 'Check it', developers: 'Developers' }

export function Curtain() {
  const { pathname } = useLocation()
  const ref = useRef<HTMLDivElement>(null)
  const mounted = useRef(false)
  const title = titles[pathname.split('/')[1] ?? ''] ?? ''

  useLayoutEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    const el = ref.current
    if (!el || reduced) return
    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .set(el, { autoAlpha: 1 })
        .set('[data-band]', { yPercent: 0 })
        .fromTo('[data-title]', { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.35, ease: 'power3.out' })
        .to('[data-title]', { yPercent: -60, autoAlpha: 0, duration: 0.3, ease: 'power3.in' }, 0.38)
        .to('[data-band="a"]', { yPercent: -100, duration: 0.75, ease: 'expo.inOut' }, 0.34)
        .to('[data-band="b"]', { yPercent: -100, duration: 0.75, ease: 'expo.inOut' }, 0.42)
        .set(el, { autoAlpha: 0 })
    }, el)
    return () => ctx.revert()
  }, [pathname])

  return (
    <div ref={ref} className="pointer-events-none fixed inset-0 z-[90]" style={{ visibility: 'hidden' }}>
      <div data-band="b" className="absolute inset-0 bg-signal" />
      <div data-band="a" className="absolute inset-0 bg-ink-2" />
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <span data-title className="display text-5xl text-paper md:text-7xl">
          {title}
        </span>
      </div>
    </div>
  )
}
