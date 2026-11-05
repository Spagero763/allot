import { useLayoutEffect, useRef } from 'react'
import { gsap, reduced, ScrollTrigger } from './scroll'
import { compact, units } from '@/lib/format'

export interface Seg {
  id: string
  label: string
  requested: number
  allotted: number
}

export interface BookData {
  name: string
  symbol: string
  total: number
  price: number
  currency: string
  segs: Seg[]
}

type Mode = 'loop' | 'scrub' | 'once' | 'live'

const alphas = [0.94, 0.6, 0.8, 0.48, 0.88, 0.66, 0.74, 0.54, 0.84]

export function BookVisual({ data, mode, className, onTimeline, settled = false }: { data: BookData; mode: Mode; className?: string; onTimeline?: (tl: gsap.core.Timeline) => void; settled?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const requested = data.segs.reduce((a, s) => a + s.requested, 0)
  const allotted = data.segs.reduce((a, s) => a + s.allotted, 0)
  const refunded = (requested - allotted) * data.price
  const scale = Math.max(requested, data.total) * 1.06 || 1
  const pct = (n: number) => `${(n / scale) * 100}%`
  const marker = pct(data.total)
  const chips = [...data.segs]
    .map((s) => ({ ...s, back: (s.requested - s.allotted) * data.price }))
    .filter((s) => s.back > 0)
    .sort((a, b) => b.back - a.back)
    .slice(0, 3)
  const signature = data.segs.map((s) => `${s.id}:${s.requested}:${s.allotted}`).join('|')

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const ctx = gsap.context(() => {
      const segEls = gsap.utils.toArray<HTMLElement>('[data-seg]')
      const chipEls = gsap.utils.toArray<HTMLElement>('[data-chip]')
      const q = (s: string) => el.querySelector<HTMLElement>(s)
      const cov = q('[data-cov]')
      const req = q('[data-req]')
      const alo = q('[data-allotted]')
      const ref = q('[data-refunded]')
      const openPill = q('[data-open]')
      const closedPill = q('[data-closed]')
      const tint = q('[data-tint]')

      const write = () => {
        if (cov) cov.textContent = `${n.cov.toFixed(2)}x`
        if (req) req.textContent = units(Math.round(n.req))
        if (alo) alo.textContent = units(Math.round(n.alo))
        if (ref) ref.textContent = compact(n.ref)
      }
      const n = { cov: 0, req: 0, alo: 0, ref: 0 }

      if (mode === 'live' || reduced) {
        const final = settled || (reduced && mode !== 'live')
        gsap.set(segEls, { width: (i) => pct(final ? data.segs[i].allotted : data.segs[i].requested) })
        gsap.set(openPill, { autoAlpha: final ? 0 : 1 })
        gsap.set(closedPill, { autoAlpha: final ? 1 : 0 })
        gsap.set(chipEls, { autoAlpha: 0 })
        n.cov = data.total ? requested / data.total : 0
        n.req = requested
        n.alo = final ? allotted : 0
        n.ref = final ? refunded : 0
        write()
        return
      }

      const tl = gsap.timeline({ paused: mode !== 'loop', repeat: mode === 'loop' ? -1 : 0, repeatDelay: 0.6, defaults: { ease: 'expo.out' }, onUpdate: write })
      tl.set(segEls, { width: '0%' })
        .set(chipEls, { autoAlpha: 0, y: 14 })
        .set(closedPill, { autoAlpha: 0 })
        .set(openPill, { autoAlpha: 1 })
        .set(tint, { autoAlpha: 1 })
        .set(n, { cov: 0, req: 0, alo: 0, ref: 0 })

      let running = 0
      data.segs.forEach((s, i) => {
        running += s.requested
        const at = i === 0 ? 0.25 : '>-0.38'
        tl.to(segEls[i], { width: pct(s.requested), duration: 0.75 }, at)
        tl.to(n, { cov: data.total ? running / data.total : 0, req: running, duration: 0.75 }, '<')
      })

      tl.addLabel('close', '+=0.8')
      tl.to(openPill, { autoAlpha: 0, duration: 0.25 }, 'close')
        .to(closedPill, { autoAlpha: 1, duration: 0.25 }, 'close+=0.1')
        .to(segEls, { width: (i) => pct(data.segs[i].allotted), duration: 1.35, ease: 'expo.inOut', stagger: 0.025 }, 'close+=0.2')
        .to(tint, { autoAlpha: 0, duration: 0.9 }, 'close+=0.5')
        .to(n, { alo: allotted, ref: refunded, duration: 1.3, ease: 'expo.inOut' }, 'close+=0.2')
      chipEls.forEach((chip, i) => {
        const at = `close+=${0.9 + i * 0.95}`
        tl.to(chip, { autoAlpha: 1, y: 0, duration: 0.45 }, at).to(chip, { autoAlpha: 0, y: -12, duration: 0.4, ease: 'power2.in' }, `${at}+=0.62`)
      })
      tl.to({}, { duration: mode === 'loop' ? 1.2 : 0.2 })

      if (mode === 'once') {
        ScrollTrigger.create({ trigger: el, start: 'top 80%', once: true, onEnter: () => tl.play() })
      }
      onTimeline?.(tl)
    }, el)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, mode, settled, data.total])

  return (
    <div ref={root} className={`card relative p-5 md:p-7 ${className ?? ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mono text-[11px] uppercase tracking-[0.2em] text-mute">{data.symbol} · book</p>
          <p className="display mt-1 text-2xl md:text-3xl">{data.name}</p>
        </div>
        <div className="relative h-7 w-20 shrink-0">
          <span data-open className="mono absolute right-0 top-0 rounded-full bg-mint/15 px-3 py-1 text-xs uppercase tracking-wider text-mint">
            open
          </span>
          <span data-closed className="mono absolute right-0 top-0 rounded-full bg-paper px-3 py-1 text-xs uppercase tracking-wider text-ink" style={{ opacity: 0 }}>
            closed
          </span>
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between">
        <div>
          <p className="text-xs text-mute">Coverage</p>
          <p className="display text-5xl tabular md:text-6xl" data-cov>
            0.00x
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-mute">Requested</p>
          <p className="mono text-sm">
            <span data-req>0</span> <span className="text-mute">/ {units(data.total)}</span>
          </p>
        </div>
      </div>

      <div className="relative mt-5">
        <div className="relative h-14 overflow-hidden rounded-xl bg-ink-3 md:h-16">
          <div className="hatch absolute inset-y-0 right-0" style={{ left: marker }} />
          <div className="absolute inset-0 flex">
            {data.segs.map((s, i) => (
              <div key={s.id} data-seg className="h-full shrink-0 border-r border-ink/70" style={{ width: 0, background: `rgba(243,238,227,${alphas[i % alphas.length]})` }} />
            ))}
          </div>
          <div data-tint className="pointer-events-none absolute inset-y-0 right-0 bg-gold/55 mix-blend-multiply" style={{ left: marker }} />
          <div className="absolute inset-y-0 w-0.5 bg-signal" style={{ left: marker }} />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center" style={{ left: marker }}>
            {chips.map((c) => (
              <span key={c.id} data-chip className="mono absolute whitespace-nowrap rounded-full border border-gold/50 bg-ink/90 px-3 py-1.5 text-[11px] text-gold" style={{ opacity: 0 }}>
                ↩ {compact(c.back)} {data.currency} back to {c.label}
              </span>
            ))}
          </div>
        </div>
        <div className="mono relative mt-1.5 h-4 text-[10px] uppercase tracking-wider text-mute">
          <span className="absolute -translate-x-1/2 text-signal" style={{ left: marker }}>
            offered
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 md:gap-3">
        <Tile label="Allotted units">
          <span data-allotted>0</span>
        </Tile>
        <Tile label={`Refunded ${data.currency}`}>
          <span data-refunded>0</span>
        </Tile>
        <Tile label="Settled in">one tx</Tile>
      </div>
    </div>
  )
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-ink-2 px-3 py-3">
      <p className="text-[10px] uppercase tracking-wider text-mute">{label}</p>
      <p className="mono mt-1 text-sm md:text-base">{children}</p>
    </div>
  )
}
