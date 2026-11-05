import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { decodeSubscription, type Offer, type Subscription } from 'allot-sdk'
import { useNow, useOffers, useProgram } from '@/lib/hooks'
import { sampleBook } from '@/lib/book'
import { short, units } from '@/lib/format'
import { BookVisual } from '@/ui/BookVisual'
import { FadeUp, Magnetic, Marquee, SplitReveal, StaggerIn } from '@/ui/fx'
import { introDelay } from '@/ui/Intro'
import { OfferCard } from '@/ui/OfferCard'
import { gsap, reduced, ScrollTrigger, scrollToId, useGsap } from '@/ui/scroll'

export function Home() {
  const { offers, error } = useOffers()
  const now = useNow()
  const open = offers?.filter((o) => o.status === 'open') ?? []
  const done = offers?.filter((o) => o.status !== 'open') ?? []

  return (
    <main>
      <Hero />
      <Ticker offers={offers ?? []} />
      <Numbers offers={offers ?? []} />

      <section id="offers" className="mx-auto max-w-6xl px-4 pt-24 md:px-6">
        <div className="flex items-end justify-between">
          <SplitReveal className="display text-5xl md:text-7xl">Open books</SplitReveal>
          <span className="mono flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-mute">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-mint" /> live
          </span>
        </div>
        {error && <p className="mt-6 text-sm text-danger">{error}</p>}
        {offers === null && !error && (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="card h-60 animate-pulse" />
            ))}
          </div>
        )}
        {offers && open.length === 0 && (
          <FadeUp className="card mt-8 p-8 text-paper-2">
            No book is open right now.{' '}
            <Link to="/issue" className="underline">
              Open one
            </Link>{' '}
            in a minute.
          </FadeUp>
        )}
        {open.length > 0 && (
          <StaggerIn className="mt-8 grid gap-4 md:grid-cols-2">
            {open.map((o) => (
              <div key={o.key.toBase58()}>
                <OfferCard offer={o} now={now} />
              </div>
            ))}
          </StaggerIn>
        )}
        {done.length > 0 && (
          <>
            <SplitReveal as="h3" className="display mt-20 text-4xl text-paper-2 md:text-5xl">
              Closed and settled
            </SplitReveal>
            <StaggerIn className="mt-8 grid gap-4 md:grid-cols-2">
              {done.map((o) => (
                <div key={o.key.toBase58()}>
                  <OfferCard offer={o} now={now} />
                </div>
              ))}
            </StaggerIn>
          </>
        )}
      </section>

      <Story />
      <Why />
      <Band />
    </main>
  )
}

function Hero() {
  const book = useMemo(sampleBook, [])
  const ref = useGsap<HTMLElement>((el) => {
    if (reduced) return
    gsap.from('[data-hero-fade]', { y: 26, autoAlpha: 0, duration: 1.1, stagger: 0.1, delay: introDelay + 0.55 })
    gsap.from('[data-hero-visual]', { y: 60, autoAlpha: 0, rotateX: 8, duration: 1.4, delay: introDelay + 0.35 })
    gsap.to('[data-glow-a]', { xPercent: -18, yPercent: 12, duration: 9, ease: 'sine.inOut', repeat: -1, yoyo: true })
    gsap.to('[data-glow-b]', { xPercent: 16, yPercent: -10, duration: 11, ease: 'sine.inOut', repeat: -1, yoyo: true })
    gsap.matchMedia().add('(min-width: 768px)', () => {
      gsap.to('[data-hero-visual]', { yPercent: -8, scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: 0.6 } })
      gsap.to('[data-hero-copy]', { yPercent: 10, autoAlpha: 0.2, scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: 0.6 } })
    })
  }, [])
  return (
    <section ref={ref} className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div data-glow-a className="absolute -top-40 right-[-10%] h-[38rem] w-[38rem] rounded-full bg-signal/20 blur-[130px]" />
        <div data-glow-b className="absolute -left-40 top-56 h-[30rem] w-[30rem] rounded-full bg-mint/10 blur-[130px]" />
      </div>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-12 md:grid-cols-12 md:gap-8 md:px-6 md:pb-20 md:pt-14">
        <div data-hero-copy className="md:col-span-7">
          <p data-hero-fade className="mono mb-6 text-xs uppercase tracking-[0.2em] text-mute">
            Primary markets, settled by the chain
          </p>
          <h1 className="display text-[2.7rem] leading-[0.95] md:text-[4.4rem] lg:text-[4.9rem]">
            <SplitReveal as="p" scroll={false} delay={introDelay}>
              Subscribe to an offer.
            </SplitReveal>
            <SplitReveal as="p" scroll={false} delay={introDelay + 0.14} className="text-paper-2">
              Your money earns while the book is open.
            </SplitReveal>
            <SplitReveal as="p" scroll={false} delay={introDelay + 0.3} className="text-signal">
              Refunds land the second it closes.
            </SplitReveal>
          </h1>
          <p data-hero-fade className="mt-8 max-w-xl text-lg text-paper-2">
            Allotment is computed on-chain from numbers anyone can check. No bank float, no weeks of waiting, no one deciding who gets what.
          </p>
          <div data-hero-fade className="mt-8 flex flex-wrap gap-3">
            <Magnetic>
              <button className="btn btn-primary" onClick={() => scrollToId('offers')}>
                See open offers
              </button>
            </Magnetic>
            <Magnetic>
              <Link to="/issue" className="btn btn-ghost">
                Open a book
              </Link>
            </Magnetic>
          </div>
        </div>
        <div className="md:col-span-5" style={{ perspective: 1200 }}>
          <div data-hero-visual>
            <BookVisual data={book} mode="loop" />
            <p className="mono mt-3 text-center text-[10px] uppercase tracking-[0.2em] text-mute">A book filling, closing and settling. Same math as the program.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function Ticker({ offers }: { offers: Offer[] }) {
  const program = useProgram()
  const [subs, setSubs] = useState<Subscription[]>([])
  const count = offers.reduce((a, o) => a + o.subscriberCount, 0)
  useEffect(() => {
    program.account.subscription
      .all()
      .then((all) => setSubs(all.map((a) => decodeSubscription(a.publicKey, a.account)).sort((a, b) => b.committedTs - a.committedTs).slice(0, 16)))
      .catch(() => setSubs([]))
  }, [program, count])
  const bySymbol = useMemo(() => Object.fromEntries(offers.map((o) => [o.key.toBase58(), o.symbol])), [offers])
  if (subs.length === 0) return null
  return (
    <div className="border-y border-line bg-ink-2/60 py-3">
      <Marquee speed={46}>
        {subs.map((s) => (
          <span key={s.key.toBase58()} className="mono flex items-center gap-3 text-xs text-paper-2">
            <span className={`h-1.5 w-1.5 rounded-full ${s.settled ? 'bg-gold' : 'bg-mint'}`} />
            <span className="text-paper">{short(s.subscriber.toBase58(), 4)}</span>
            {s.settled ? `allotted ${units(Number(s.allottedUnits))} of ${units(Number(s.units))}` : `committed ${units(Number(s.units))} units`}
            <span className="text-mute">{bySymbol[s.offer.toBase58()] ?? ''}</span>
          </span>
        ))}
      </Marquee>
    </div>
  )
}

function Numbers({ offers }: { offers: Offer[] }) {
  const committed = offers.reduce((a, o) => a + Number(o.principal) / 10 ** o.mintDecimals, 0)
  const subscriptions = offers.reduce((a, o) => a + o.subscriberCount, 0)
  const settled = offers.reduce((a, o) => a + o.processed, 0)
  const items = [
    { label: 'Committed to open and past books', value: committed, format: (v: number) => `$${Math.round(v).toLocaleString('en')}` },
    { label: 'Subscriptions', value: subscriptions, format: (v: number) => Math.round(v).toLocaleString('en') },
    { label: 'Allotments settled on-chain', value: settled, format: (v: number) => Math.round(v).toLocaleString('en') },
    { label: 'Books', value: offers.length, format: (v: number) => Math.round(v).toLocaleString('en') },
  ]
  return (
    <section className="mx-auto max-w-6xl px-4 pt-14 md:px-6">
      <dl className="grid grid-cols-2 gap-y-8 md:grid-cols-4">
        {items.map((it) => (
          <Rolling key={it.label} {...it} />
        ))}
      </dl>
    </section>
  )
}

function Rolling({ label, value, format }: { label: string; value: number; format: (v: number) => string }) {
  const el = useRef<HTMLElement>(null)
  const state = useRef({ v: 0 })
  useEffect(() => {
    if (!el.current) return
    const node = el.current
    const tween = gsap.to(state.current, {
      v: value,
      duration: reduced ? 0 : 1.6,
      ease: 'expo.out',
      onUpdate: () => (node.textContent = format(state.current.v)),
      scrollTrigger: { trigger: node, start: 'top 95%', once: true },
    })
    return () => {
      tween.kill()
    }
  }, [value, format])
  return (
    <div className="border-l border-line pl-4">
      <dd ref={el} className="display text-4xl tabular md:text-5xl">
        {format(0)}
      </dd>
      <dt className="mt-2 max-w-[14rem] text-xs text-mute">{label}</dt>
    </div>
  )
}

const steps = [
  { title: 'The book opens', body: 'An issuer fixes the price, the number of units, the floor every subscriber is guaranteed, and the close. Nothing can be changed after that, by anyone.' },
  { title: 'People commit', body: 'Stablecoins move from each wallet into a vault the program controls. Demand passes what is on offer. The money can earn in a lending market until the close.' },
  { title: 'The chain allots', body: 'At close, every allotment is computed from the totals on the account. The excess goes straight back with its share of the yield, and receipts are minted. One transaction each.' },
]

function Story() {
  const book = useMemo(sampleBook, [])
  const tl = useRef<gsap.core.Timeline | null>(null)
  const [active, setActive] = useState(0)
  const ref = useGsap<HTMLElement>((el) => {
    if (reduced) return
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: '+=240%',
      pin: '[data-pin]',
      scrub: 0.5,
      onUpdate: (self) => {
        const t = tl.current
        if (!t) return
        t.progress(self.progress)
        const close = (t.labels.close ?? t.duration() * 0.6) / t.duration()
        setActive(self.progress < 0.07 ? 0 : self.progress < close ? 1 : 2)
        gsap.set('[data-rail]', { scaleX: self.progress })
      },
    })
    return () => st.kill()
  }, [])
  return (
    <section ref={ref} className="relative mt-28">
      <div data-pin className="flex min-h-dvh items-center">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 md:grid-cols-12 md:px-6">
          <div className="md:col-span-5">
            <p className="mono text-xs uppercase tracking-[0.2em] text-mute">How a book works</p>
            <div className="mt-3 h-px w-full bg-line">
              <div data-rail className="h-px origin-left bg-signal" style={{ transform: 'scaleX(0)' }} />
            </div>
            <div className="relative mt-6 min-h-[15rem] md:min-h-[19rem]">
              {steps.map((s, i) => (
                <div key={s.title} className="absolute inset-0 transition-all duration-700 ease-out" style={{ opacity: active === i ? 1 : 0, transform: `translateY(${active === i ? 0 : active > i ? -24 : 24}px)` }}>
                  <span className="mono text-xs text-mute">
                    0{i + 1} / 0{steps.length}
                  </span>
                  <h3 className="display mt-3 text-5xl md:text-6xl">{s.title}</h3>
                  <p className="mt-4 max-w-md text-paper-2">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="md:col-span-7">
            <BookVisual data={book} mode={reduced ? 'live' : 'scrub'} settled={reduced} onTimeline={(t) => (tl.current = t)} />
          </div>
        </div>
      </div>
    </section>
  )
}

const facts = [
  { k: '3x', v: 'A recent national offer drew three times the money it needed. Two thirds of it had to be sent back, and it took weeks.' },
  { k: '0', v: 'Humans between the close and your refund. Anyone can run the close, including you.' },
  { k: '1', v: 'Transaction for your refund, your yield share and your receipts.' },
]

function Why() {
  const ref = useGsap<HTMLElement>((el) => {
    if (reduced) return
    gsap.utils.toArray<HTMLElement>('[data-fact]').forEach((row) => {
      gsap.from(row.querySelector('[data-k]'), { xPercent: -30, autoAlpha: 0, duration: 1.2, scrollTrigger: { trigger: row, start: 'top 85%', once: true } })
      gsap.from(row.querySelector('[data-line]'), { scaleX: 0, duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: row, start: 'top 85%', once: true } })
      gsap.from(row.querySelector('[data-v]'), { y: 24, autoAlpha: 0, duration: 1, delay: 0.15, scrollTrigger: { trigger: row, start: 'top 85%', once: true } })
    })
    void el
  }, [])
  return (
    <section ref={ref} className="mx-auto max-w-6xl px-4 pt-6 md:px-6">
      <SplitReveal className="display max-w-3xl text-5xl md:text-7xl">Why the chain, and not a bank</SplitReveal>
      <FadeUp className="mt-6 max-w-2xl text-lg text-paper-2">
        When a big offer is oversubscribed, most of the money sent in is refunded. On the old rails that refund takes weeks and earns the subscriber nothing. Here it sits in a vault the program controls and comes back the moment the allotment is computed.
      </FadeUp>
      <div className="mt-12">
        {facts.map((f) => (
          <div key={f.k} data-fact className="relative grid items-baseline gap-4 py-8 md:grid-cols-12">
            <div data-line className="absolute inset-x-0 top-0 h-px origin-left bg-line-2" />
            <span data-k className="display text-7xl text-paper md:col-span-3 md:text-9xl">
              {f.k}
            </span>
            <p data-v className="text-xl text-paper-2 md:col-span-8 md:col-start-5 md:text-2xl">
              {f.v}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Band() {
  const ref = useGsap<HTMLElement>((el) => {
    if (reduced) return
    gsap.to('[data-row="a"]', { xPercent: -22, scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.6 } })
    gsap.fromTo('[data-row="b"]', { xPercent: -22 }, { xPercent: 0, scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.6 } })
  }, [])
  const words = ['Open a book', 'Commit', 'Earn while you wait', 'Get allotted', 'Refunded at close']
  return (
    <section ref={ref} className="mt-28 overflow-hidden border-y border-line py-10">
      <div data-row="a" className="display flex w-max gap-10 whitespace-nowrap text-7xl md:text-9xl">
        {[...words, ...words].map((w, i) => (
          <span key={i} className={i % 2 ? 'outline-text' : ''}>
            {w}
          </span>
        ))}
      </div>
      <div data-row="b" className="display mt-4 flex w-max gap-10 whitespace-nowrap text-7xl md:text-9xl">
        {[...words, ...words].reverse().map((w, i) => (
          <span key={i} className={i % 2 ? '' : 'outline-text'}>
            {w}
          </span>
        ))}
      </div>
      <div className="mx-auto mt-12 flex max-w-6xl flex-col items-start gap-5 px-4 md:flex-row md:items-center md:justify-between md:px-6">
        <p className="max-w-lg text-lg text-paper-2">Raising, or building for people who subscribe? The program is open and permissionless.</p>
        <div className="flex gap-3">
          <Magnetic>
            <Link to="/issue" className="btn btn-signal">
              Open a book
            </Link>
          </Magnetic>
          <Magnetic>
            <Link to="/developers" className="btn btn-ghost">
              Read the program
            </Link>
          </Magnetic>
        </div>
      </div>
    </section>
  )
}
