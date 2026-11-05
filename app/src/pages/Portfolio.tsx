import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { useMySubscriptions, useProgram } from '@/lib/hooks'
import { allotment, fetchOffer, yieldShare, type Offer, type Subscription } from 'allot-sdk'
import { dateLabel, money, units } from '@/lib/format'
import { Item, Page, Reveal, Stagger } from '@/ui/motion'
import { Status } from '@/ui/Status'

export function Portfolio() {
  const { publicKey } = useWallet()
  const { subs } = useMySubscriptions()
  const program = useProgram()
  const [offers, setOffers] = useState<Record<string, Offer>>({})

  useEffect(() => {
    if (!subs) return
    const missing = subs.map((s) => s.offer.toBase58()).filter((k) => !offers[k])
    if (missing.length === 0) return
    Promise.all(missing.map((k) => fetchOffer(program, new PublicKey(k)))).then((list) => {
      setOffers((prev) => {
        const next = { ...prev }
        list.forEach((o, i) => {
          if (o) next[missing[i]] = o
        })
        return next
      })
    })
  }, [subs, program, offers])

  const rows = (subs ?? []).map((s) => ({ s, o: offers[s.offer.toBase58()] })).filter((r) => r.o) as { s: Subscription; o: Offer }[]
  const committed = rows.reduce((a, r) => a + Number(r.s.amount), 0)
  const refunded = rows.reduce((a, r) => a + (r.s.settled ? Number(r.s.refund) : 0), 0)
  const earned = rows.reduce((a, r) => a + (r.s.settled ? Number(r.s.yieldShare) : 0), 0)
  const receipts = rows.reduce((a, r) => a + (r.s.settled ? Number(r.s.allottedUnits) : 0), 0)

  return (
    <Page className="mx-auto max-w-6xl px-4 pt-10 md:px-6 md:pt-16">
      <Reveal>
        <p className="mono text-xs uppercase tracking-[0.2em] text-mute">Portfolio</p>
        <h1 className="display mt-2 text-5xl md:text-6xl">Your books</h1>
      </Reveal>
      {!publicKey && <p className="mt-8 text-paper-2">Connect a wallet to see your subscriptions, refunds and receipts.</p>}
      {publicKey && (
        <>
          <Stagger className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Tile label="Committed" value={money(committed, 6)} />
            <Tile label="Refunded" value={money(refunded, 6)} />
            <Tile label="Earned while waiting" value={money(earned, 6, 'USDC', 4)} />
            <Tile label="Receipts" value={units(receipts)} />
          </Stagger>
          <div className="mt-10 space-y-3">
            {subs && subs.length === 0 && (
              <div className="card p-8 text-paper-2">
                Nothing yet. <Link to="/" className="underline">Find an open book.</Link>
              </div>
            )}
            {rows.map(({ s, o }) => {
              const a = s.settled ? s.allottedUnits : allotment(o, s.units)
              const ys = s.settled ? s.yieldShare : yieldShare(o, s.weight)
              return (
                <Link key={s.key.toBase58()} to={`/o/${o.key.toBase58()}`} className="card block p-5 transition hover:border-line-2 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="mono text-xs uppercase tracking-[0.2em] text-mute">{o.symbol}</p>
                      <h2 className="display mt-1 text-3xl">{o.name}</h2>
                      <p className="mt-1 text-sm text-mute">Committed {dateLabel(s.committedTs)}</p>
                    </div>
                    <Status offer={o} />
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                    <Cell k="Requested" v={`${units(Number(s.units))} units`} />
                    <Cell k={s.settled ? 'Allotted' : 'If closed now'} v={`${units(Number(a))} units`} />
                    <Cell k={s.settled ? 'Refunded' : 'Likely refund'} v={money(s.settled ? s.refund : s.amount - a * o.unitPrice, o.mintDecimals)} />
                    <Cell k="Yield share" v={money(ys, o.mintDecimals, 'USDC', 4)} />
                  </dl>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </Page>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Item className="card p-5">
      <p className="text-xs text-mute">{label}</p>
      <p className="display mt-2 text-3xl tabular">{value}</p>
    </Item>
  )
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-mute">{k}</dt>
      <dd className="tabular mt-1">{v}</dd>
    </div>
  )
}
