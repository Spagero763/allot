import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { gsap, reduced, SplitText, useGsap } from './scroll'

export function Magnetic({ children, strength = 0.35, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || reduced || window.matchMedia('(pointer: coarse)').matches) return
    const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' })
    const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' })
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      x((e.clientX - (r.left + r.width / 2)) * strength)
      y((e.clientY - (r.top + r.height / 2)) * strength)
    }
    const leave = () => {
      x(0)
      y(0)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [strength])
  return (
    <span ref={ref} className={`inline-block will-change-transform ${className ?? ''}`}>
      {children}
    </span>
  )
}

export function Spotlight({ children, className, tilt = 4 }: { children: ReactNode; className?: string; tilt?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || reduced || window.matchMedia('(pointer: coarse)').matches) return
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' })
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' })
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      el.style.setProperty('--mx', `${px * 100}%`)
      el.style.setProperty('--my', `${py * 100}%`)
      rx((0.5 - py) * tilt)
      ry((px - 0.5) * tilt)
    }
    const leave = () => {
      rx(0)
      ry(0)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [tilt])
  return (
    <div ref={ref} className={`spotlight ${className ?? ''}`} style={{ transformPerspective: 900 } as CSSProperties}>
      {children}
    </div>
  )
}

export function SplitReveal({ children, as: Tag = 'h2', className, delay = 0, scroll = true }: { children: ReactNode; as?: 'h1' | 'h2' | 'h3' | 'p'; className?: string; delay?: number; scroll?: boolean }) {
  const ref = useGsap<HTMLElement>((el) => {
    if (reduced) return
    const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' })
    gsap.from(split.lines, {
      yPercent: 110,
      duration: 1.1,
      stagger: 0.09,
      delay,
      scrollTrigger: scroll ? { trigger: el, start: 'top 88%', once: true } : undefined,
    })
  }, [])
  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>
  )
}

export function FadeUp({ children, className, delay = 0, y = 28 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  const ref = useGsap<HTMLDivElement>((el) => {
    if (reduced) return
    gsap.from(el, { y, autoAlpha: 0, duration: 1, delay, scrollTrigger: { trigger: el, start: 'top 90%', once: true } })
  }, [])
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

export function StaggerIn({ children, className, selector = ':scope > *', gap = 0.08 }: { children: ReactNode; className?: string; selector?: string; gap?: number }) {
  const ref = useGsap<HTMLDivElement>((el) => {
    if (reduced) return
    gsap.from(el.querySelectorAll(selector), { y: 36, autoAlpha: 0, duration: 1, stagger: gap, scrollTrigger: { trigger: el, start: 'top 86%', once: true } })
  }, [])
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

export function Digits({ value, className }: { value: string; className?: string }) {
  return (
    <span className={`inline-flex overflow-hidden tabular ${className ?? ''}`} aria-label={value}>
      {value.split('').map((ch, i) => (/\d/.test(ch) ? <Digit key={i} d={Number(ch)} /> : <span key={i}>{ch}</span>))}
    </span>
  )
}

function Digit({ d }: { d: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!ref.current) return
    gsap.to(ref.current, { yPercent: -10 * d, duration: reduced ? 0 : 0.7, ease: 'expo.out' })
  }, [d])
  return (
    <span className="relative inline-block h-[1em] overflow-hidden leading-none" aria-hidden>
      <span ref={ref} className="flex flex-col">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span key={n} className="h-[1em] leading-none">
            {n}
          </span>
        ))}
      </span>
    </span>
  )
}

export function Marquee({ children, speed = 40, className }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useGsap<HTMLDivElement>((el) => {
    const track = el.querySelector<HTMLElement>('[data-track]')
    if (!track || reduced) return
    const half = track.scrollWidth / 2
    if (half === 0) return
    gsap.to(track, { x: -half, duration: half / speed, ease: 'none', repeat: -1 })
  }, [children])
  return (
    <div ref={ref} className={`overflow-hidden ${className ?? ''}`}>
      <div data-track className="flex w-max items-center gap-10 whitespace-nowrap will-change-transform">
        {children}
        {children}
      </div>
    </div>
  )
}

export function tweenNumber(el: Element | null, to: number, format: (v: number) => string, vars: gsap.TweenVars = {}) {
  if (!el) return gsap.to({}, {})
  const proxy = { v: Number((el as HTMLElement).dataset.v ?? 0) }
  return gsap.to(proxy, {
    v: to,
    duration: 1.2,
    ease: 'expo.out',
    ...vars,
    onUpdate: () => {
      ;(el as HTMLElement).dataset.v = String(proxy.v)
      el.textContent = format(proxy.v)
    },
  })
}
