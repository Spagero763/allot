import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useNow, useOffers } from '@/lib/hooks'
import type { Offer } from 'allot-sdk'
import { coverage, countdown, money, units } from '@/lib/format'
import { Bar, Counter, Item, Page, Reveal, Stagger, ease } from '@/ui/motion'
import { Status } from '@/ui/Status'

export function Landing() {
  const { offers, error } = useOffers()
  const now = useNow()
  const open = offers?.filter((o) => o.status === 'open') ?? []
  const done = offers?.filter((o) => o.status !== 'open') ?? []
  const principal = offers?.reduce((a, o) => a + Number(o.principal), 0) ?? 0
  const subscribers = offers?.reduce((a, o) => a + o.subscriberCount, 0) ?? 0
  const refunded = offers?.reduce((a, o) => a + Number(o.processed), 0) ?? 0

  return (
    <Page>
      <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 md:px-6 md:pt-24">
        <Glow />
        <div className="relative grid gap-10 md:grid-cols-12 md:gap-6">
          <div className="md:col-span-8">
            <Reveal>
              <p className="mono mb-5 text-xs uppercase tracking-[0.2em] text-mute">Primary markets, settled by the chain</p>
            </Reveal>
            <h1 className="display text-[2.9rem] leading-[0.95] md:text-[5.2rem]">
              <Word delay={0.05}>Subscribe to an offer.</Word>
              <br />
              <Word delay={0.18} className="text-paper-2">
                Your money earns
              </Word>{' '}
              <Word delay={0.26} className="text-paper-2">
                while the book is open.
              </Word>
              <br />
              <Word delay={0.4} className="text-signal">
                Refunds land the second it closes.
              </Word>
            </h1>
            <Reveal delay={0.5} className="mt-8 max-w-xl text-lg text-paper-2">
              Allotment is computed on-chain from numbers anyone can check. No bank float, no weeks of waiting, no one deciding who gets what.
            </Reveal>
            <Reveal delay={0.6} className="mt-8 flex flex-wrap gap-3">
              <a href="#offers" className="btn btn-primary">
                See open offers
              </a>
              <Link to="/issue" className="btn btn-ghost">
                Open a book
              </Link>
            </Reveal>
          </div>
          <div className="md:col-span-4">
            <Reveal delay={0.35} className="card p-6">
              <p className="mono text-xs uppercase tracking-[0.2em] text-mute">On this program</p>
              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6">
                <Stat label="Committed" value={principal / 1e6} format={(v) => `$${Math.round(v).toLocaleString('en')}`} />
                <Stat label="Subscriptions" value={subscribers} />
                <Stat label="Settled" value={refunded} />
                <Stat label="Offers" value={offers?.length ?? 0} />
              </dl>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="offers" className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="flex items-end justify-between">
          <h2 className="display text-4xl md:text-5xl">Open books</h2>
          <span className="mono flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-mute">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-mint" /> live
          </span>
        </div>
        {error && <p className="mt-6 text-sm text-danger">{error}</p>}
        {offers === null && !error && <Skeleton />}
        {offers && open.length === 0 && (
          <div className="card mt-6 p-8 text-paper-2">
            No book is open right now. <Link to="/issue" className="underline">Open one</Link> in a minute.
          </div>
        )}
        <Stagger className="mt-6 grid gap-4 md:grid-cols-2">
          {open.map((o) => (
            <Item key={o.key.toBase58()}>
              <OfferCard offer={o} now={now} />
            </Item>
          ))}
        </Stagger>
        {done.length > 0 && (
          <>
            <h3 className="display mt-16 text-3xl text-paper-2">Closed and settled</h3>
            <Stagger className="mt-6 grid gap-4 md:grid-cols-2">
              {done.map((o) => (
                <Item key={o.key.toBase58()}>
                  <OfferCard offer={o} now={now} />
                </Item>
              ))}
            </Stagger>
          </>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-28 md:px-6">
        <Reveal>
          <h2 className="display text-4xl md:text-5xl">How a book works</h2>
        </Reveal>
        <Stagger className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <Item key={s.title} className="card p-6">
              <span className="mono text-xs text-mute">0{i + 1}</span>
              <h3 className="display mt-4 text-3xl">{s.title}</h3>
              <p className="mt-3 text-paper-2">{s.body}</p>
            </Item>
          ))}
        </Stagger>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-28 md:px-6">
        <div className="card overflow-hidden p-6 md:p-10">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <Reveal>
                <h2 className="display text-4xl md:text-5xl">Why the chain, not a bank</h2>
              </Reveal>
              <Reveal delay={0.1} className="mt-5 text-paper-2">
                When a big offer is oversubscribed, most of the money sent in is refunded. On the old rails that refund takes weeks and earns the subscriber nothing. Here the money sits in a vault the program controls, earns while the book is open, and comes back the moment the allotment is computed.
              </Reveal>
            </div>
            <ul className="space-y-4 text-paper-2">
              {facts.map((f) => (
                <Reveal key={f.k} className="flex items-start gap-4 border-b border-line pb-4">
                  <span className="display shrink-0 text-3xl text-paper">{f.k}</span>
                  <span>{f.v}</span>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </Page>
  )
}

const steps = [
  { title: 'The book opens', body: 'An issuer fixes the price, the number of units, the floor every subscriber is guaranteed, and the close. Nothing can be changed after that.' },
  { title: 'You commit', body: 'Send stablecoins from your own wallet. They sit in a vault the program controls and can earn in a lending market until the close.' },
  { title: 'The chain allots', body: 'At close the allotment is computed from the totals on the account. Refunds and your share of the yield are paid out, and receipts are minted to you.' },
]

const facts = [
  { k: '3x', v: 'A recent national offer drew three times the money it needed. Two thirds of it is still waiting to be refunded.' },
  { k: '0', v: 'Humans in the loop between close and refund. Anyone can run the close, including you.' },
  { k: '1 tx', v: 'Your refund, your yield share and your receipts settle together.' },
]

function Word({ children, delay, className }: { children: React.ReactNode; delay: number; className?: string }) {
  return (
    <span className="inline-block overflow-hidden align-bottom">
      <motion.span className={`inline-block ${className ?? ''}`} initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ duration: 1, ease, delay }}>
        {children}
      </motion.span>
    </span>
  )
}

function Stat({ label, value, format }: { label: string; value: number; format?: (v: number) => string }) {
  return (
    <div>
      <dt className="text-xs text-mute">{label}</dt>
      <dd className="display mt-1 text-3xl tabular">
        <Counter value={value} format={format} />
      </dd>
    </div>
  )
}

function Glow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 right-[-10%] h-[36rem] w-[36rem] rounded-full bg-signal/15 blur-[120px]" />
      <div className="absolute -left-40 top-40 h-[28rem] w-[28rem] rounded-full bg-mint/10 blur-[120px]" />
    </div>
  )
}

function Skeleton() {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="card h-56 animate-pulse" />
      ))}
    </div>
  )
}

export function OfferCard({ offer, now }: { offer: Offer; now: number }) {
  const cd = countdown(offer.closeTs, now)
  const requested = Number(offer.unitsRequested)
  const total = Number(offer.totalUnits)
  const raise = offer.totalUnits * offer.unitPrice
  return (
    <Link to={`/o/${offer.key.toBase58()}`} className="card group block p-6 transition hover:border-line-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mono text-xs uppercase tracking-[0.2em] text-mute">{offer.symbol}</p>
          <h3 className="display mt-1 text-3xl">{offer.name}</h3>
        </div>
        <Status offer={offer} />
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-mute">Raise</p>
          <p className="tabular mt-1">{money(raise, offer.mintDecimals)}</p>
        </div>
        <div>
          <p className="text-mute">Unit</p>
          <p className="tabular mt-1">{money(offer.unitPrice, offer.mintDecimals)}</p>
        </div>
        <div>
          <p className="text-mute">{offer.status === 'open' ? 'Closes in' : 'Covered'}</p>
          <p className="mono mt-1">{offer.status === 'open' ? cd.label : coverage(requested, total)}</p>
        </div>
      </div>
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs text-mute">
          <span>
            {units(requested)} of {units(total)} units requested
          </span>
          <span className="mono text-paper">{coverage(requested, total)}</span>
        </div>
        <Bar className="mt-2" value={requested} max={total} />
      </div>
    </Link>
  )
}
