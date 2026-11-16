import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { AnimatePresence, motion } from 'motion/react'
import { allotment, allotIx, cancelOfferIx, cancelSubscriptionIx, closeOfferIx, finalizeIx, subscribeIx, unsweepIx, vaultOf, yieldShare, type Offer, type Subscription } from 'allot-sdk'
import { ComputeBudgetProgram, type PublicKey, type TransactionInstruction } from '@solana/web3.js'
import { useEarning, useMySubscription, useNow, useOffer, useProgram, useSend } from '@/lib/hooks'
import { countdown, dateLabel, explorer, explorerAddress, money, short, units } from '@/lib/format'
import { Page, ease } from '@/ui/motion'
import { BookVisual } from '@/ui/BookVisual'
import { Digits, FadeUp, SplitReveal } from '@/ui/fx'
import { bookOf } from '@/lib/book'
import { mintInfo } from '@/lib/mints'
import { Eligibility } from '@/ui/Eligibility'
import { Status } from '@/ui/Status'
import { useConfig } from '@/lib/useConfig'
import { Faucet } from '@/ui/Faucet'

export function OfferPage() {
  const { offer: key } = useParams()
  const { offer, subs, reload } = useOffer(key)
  const now = useNow()
  if (offer === undefined) return <Page className="mx-auto max-w-6xl px-4 py-20 md:px-6"><div className="card h-80 animate-pulse" /></Page>
  if (offer === null)
    return (
      <Page className="mx-auto max-w-6xl px-4 py-20 md:px-6">
        <h1 className="display text-4xl">No such offer</h1>
        <Link to="/" className="btn btn-ghost mt-6">Back to offers</Link>
      </Page>
    )
  return <OfferView offer={offer} subs={subs} now={now} reload={reload} />
}

function OfferView({ offer, subs, now, reload }: { offer: Offer; subs: Subscription[]; now: number; reload: () => void }) {
  const total = Number(offer.totalUnits)
  const cd = countdown(offer.closeTs, now)
  const sym = mintInfo(offer.mint, offer.mintDecimals).symbol
  const book = useMemo(() => bookOf(offer, subs, sym), [offer, subs, sym])
  const raise = offer.totalUnits * offer.unitPrice
  const closable = offer.status === 'open' && now >= offer.closeTs
  const pending = subs.filter((s) => !s.settled)
  const earning = useEarning(offer)
  const accrued = BigInt(Math.floor(earning?.earned ?? 0))

  return (
    <Page>
      <section className="mx-auto max-w-6xl px-4 pt-10 md:px-6 md:pt-16">
        <Link to="/" className="mono text-xs uppercase tracking-[0.2em] text-mute hover:text-paper">← offers</Link>
        <div className="mt-6 grid gap-8 md:grid-cols-12">
          <div className="min-w-0 md:col-span-7">
            <div className="flex items-center gap-3">
              <span className="mono text-xs uppercase tracking-[0.2em] text-mute">{offer.symbol}</span>
              <Status offer={offer} />
              {offer.gate && <span className="mono rounded-full bg-gold/15 px-3 py-1 text-xs uppercase tracking-wider text-gold">verified only</span>}
            </div>
            <SplitReveal as="h1" scroll={false} delay={0.5} className="display mt-3 text-5xl md:text-7xl">
              {offer.name}
            </SplitReveal>
            <FadeUp delay={0.7} className="mt-4 max-w-xl text-paper-2">
              {units(total)} units at {money(offer.unitPrice, offer.mintDecimals, sym)} each. Raise of {money(raise, offer.mintDecimals, sym)}.
              {offer.floorUnits > 0n && <> Every subscriber is guaranteed up to {units(Number(offer.floorUnits))} units before the rest is shared pro rata.</>}
            </FadeUp>

            <FadeUp delay={0.8} className="mt-8">
              <BookVisual bare data={book} mode={offer.status === 'open' ? 'live' : 'once'} />
            </FadeUp>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <Fact k={offer.status === 'open' ? (cd.done ? 'Ready to close' : 'Closes in') : 'Closed'} v={offer.status === 'open' ? cd.done ? 'now' : <Digits value={cd.label} /> : dateLabel(offer.closedTs || offer.closeTs)} />
              <Fact k="Committed" v={money(offer.principal, offer.mintDecimals, sym)} />
              <Fact k="Min raise" v={offer.minRaiseUnits === 0n ? 'none' : `${units(Number(offer.minRaiseUnits))} units`} />
              {offer.status !== 'open' && offer.yieldTotal > 0n ? (
                <Fact k="Earned while open" v={money(offer.yieldTotal, offer.mintDecimals, sym, 4)} />
              ) : (
                <Fact k="While open" v={offer.strategy === 'jupiterLend' ? 'Lent on Jupiter' : 'Held in vault'} />
              )}
            </dl>

            {earning && offer.status === 'open' && <Earning offer={offer} earned={earning.earned} perSecond={earning.steady ? earning.perSecond : 0} sym={sym} />}

            <Lifecycle offer={offer} now={now} />

            <div className="mt-10">
              <h2 className="display text-3xl">Book</h2>
              <p className="mt-2 text-sm text-mute">Every commit, in order. Anyone can recompute any line from the totals above.</p>
              <div className="mt-4 overflow-hidden rounded-2xl border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-ink-2 text-left text-xs uppercase tracking-wider text-mute">
                    <tr>
                      <th className="px-4 py-3 font-normal">Subscriber</th>
                      <th className="px-4 py-3 font-normal">Requested</th>
                      <th className="px-4 py-3 font-normal">{offer.status === 'open' ? 'If closed now' : 'Allotted'}</th>
                      <th className="px-4 py-3 font-normal">Refund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-mute">No commits yet.</td>
                      </tr>
                    )}
                    {subs.map((s) => {
                      const a = s.settled ? s.allottedUnits : allotment(offer, s.units)
                      const refund = s.settled ? s.refund + s.yieldShare : s.amount - a * offer.unitPrice
                      return (
                        <tr key={s.key.toBase58()} className="border-t border-line">
                          <td className="px-4 py-3">
                            <Link to={`/verify/${offer.key.toBase58()}/${s.subscriber.toBase58()}`} className="mono hover:underline">
                              {short(s.subscriber.toBase58())}
                            </Link>
                          </td>
                          <td className="tabular px-4 py-3">{units(Number(s.units))}</td>
                          <td className="tabular px-4 py-3">{units(Number(a))}</td>
                          <td className="tabular px-4 py-3">{money(refund, offer.mintDecimals, sym)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="min-w-0 md:col-span-5">
            <div className="sticky top-24 space-y-4">
              <SubscribePanel offer={offer} now={now} reload={reload} accrued={accrued} />
              <Operations offer={offer} closable={closable} pending={pending} reload={reload} />
              {offer.status === 'settled' && <Settlement offer={offer} sym={sym} />}
              <div className="card p-5 text-xs text-mute">
                <p>Offer account</p>
                <a className="mono block truncate text-paper hover:underline" href={explorerAddress(offer.key.toBase58())} target="_blank" rel="noreferrer">
                  {offer.key.toBase58()}
                </a>
                <p className="mt-3">Receipt mint</p>
                <a className="mono block truncate text-paper hover:underline" href={explorerAddress(offer.receiptMint.toBase58())} target="_blank" rel="noreferrer">
                  {offer.receiptMint.toBase58()}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Page>
  )
}

function Earning({ offer, earned, perSecond, sym }: { offer: Offer; earned: number; perSecond: number; sym: string }) {
  const lent = Number(offer.inStrategy)
  const rate = lent > 0 ? (perSecond * 31_536_000 * 100) / lent : 0
  const value = (earned / 10 ** offer.mintDecimals).toFixed(6)
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease }}
      className="relative mt-3 overflow-hidden rounded-2xl border border-mint/25 bg-mint/[0.04] px-5 py-4"
    >
      <motion.span
        aria-hidden
        className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-mint/10 to-transparent"
        animate={{ x: ['-120%', '420%'] }}
        transition={{ duration: 3.6, ease: 'linear', repeat: Infinity }}
      />
      <div className="relative flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="flex items-center gap-2 text-xs text-mint">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
            </span>
            Earning for subscribers right now
          </p>
          <p className="mono mt-2 text-2xl text-paper md:text-3xl">
            <Digits value={value} /> <span className="text-base text-mute">{sym}</span>
          </p>
        </div>
        <dl className="flex gap-8 text-sm">
          <div>
            <dt className="text-xs text-mute">Lent on Jupiter</dt>
            <dd className="mono mt-1 text-paper">{money(offer.inStrategy, offer.mintDecimals, sym)}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">Current rate</dt>
            <dd className="mono mt-1 text-paper">{rate > 0 ? `${rate.toFixed(2)}% a year` : 'measuring'}</dd>
          </div>
        </dl>
      </div>
    </motion.div>
  )
}

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line px-4 py-3">
      <dt className="text-xs text-mute">{k}</dt>
      <dd className="mono mt-1 text-paper">{v}</dd>
    </div>
  )
}

function Lifecycle({ offer, now }: { offer: Offer; now: number }) {
  const stages = [
    { label: 'Open', done: true },
    { label: 'Closed', done: offer.status !== 'open' || now >= offer.closeTs },
    { label: 'Allotted', done: offer.status !== 'open' && offer.processed === offer.subscriberCount },
    { label: 'Settled', done: offer.status === 'settled' },
  ]
  return (
    <ol className="mt-8 grid grid-cols-4 gap-2">
      {stages.map((s, i) => (
        <li key={s.label} className="text-xs">
          <motion.div
            className={`h-1 rounded-full ${s.done ? 'bg-paper' : 'bg-ink-3'}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, ease, delay: i * 0.08 }}
            style={{ transformOrigin: 'left' }}
          />
          <span className={`mt-2 block ${s.done ? 'text-paper' : 'text-mute'}`}>{s.label}</span>
        </li>
      ))}
    </ol>
  )
}

function SubscribePanel({ offer, now, reload, accrued }: { offer: Offer; now: number; reload: () => void; accrued: bigint }) {
  const { publicKey } = useWallet()
  const program = useProgram()
  const { send, state, reset } = useSend()
  const { sub, reload: reloadSub } = useMySubscription(offer)
  const { connection } = useConnection()
  const [raw, setRaw] = useState('')
  const [attestation, setAttestation] = useState<PublicKey | null>(null)
  const sym = mintInfo(offer.mint, offer.mintDecimals).symbol
  const open = offer.status === 'open' && now >= offer.openTs && now < offer.closeTs
  const n = useMemo(() => {
    const v = BigInt(Math.max(0, Math.floor(Number(raw) || 0)))
    return v
  }, [raw])
  const amount = n * offer.unitPrice
  const projected = useMemo(() => {
    if (n === 0n) return 0n
    const hypothetical = { ...offer, unitsRequested: offer.unitsRequested + n, floorDemand: offer.floorDemand + (n < offer.floorUnits ? n : offer.floorUnits) }
    return allotment(hypothetical, n)
  }, [offer, n])
  const tooLow = n > 0n && n < offer.minUnits
  const tooHigh = offer.maxUnits > 0n && n > offer.maxUnits

  const landed = state.status === 'done' ? state.sig : null
  useEffect(() => {
    if (!landed) return
    reload()
    reloadSub()
  }, [landed, reload, reloadSub])

  async function commit() {
    if (!publicKey) return
    reset()
    await send([await subscribeIx(program, offer, publicKey, n, attestation)])
  }

  async function leave() {
    if (!publicKey || !sub) return
    reset()
    const idle = BigInt((await connection.getTokenAccountBalance(vaultOf(offer))).value.amount)
    const recall = idle < sub.amount ? await recallIxs(program, offer, publicKey, true) : []
    await send([...recall, await cancelSubscriptionIx(program, offer, publicKey)])
  }

  if (sub) {
    const a = sub.settled ? sub.allottedUnits : allotment(offer, sub.units)
    const refund = sub.settled ? sub.refund : sub.amount - a * offer.unitPrice
    const ys = sub.settled ? sub.yieldShare : yieldShare(offer.status === 'open' ? { ...offer, yieldTotal: accrued } : offer, sub.weight)
    return (
      <div className="card p-6">
        <p className="mono text-xs uppercase tracking-[0.2em] text-mute">Your position</p>
        <p className="display mt-2 text-4xl tabular">{units(Number(sub.units))} units</p>
        <p className="text-sm text-paper-2">{money(sub.amount, offer.mintDecimals, sym)} committed {dateLabel(sub.committedTs)}</p>
        <dl className="mt-5 space-y-2 text-sm">
          <Row k={sub.settled ? 'Allotted' : 'If the book closed now'} v={`${units(Number(a))} units`} />
          <Row k="Refund" v={money(refund, offer.mintDecimals, sym)} />
          <Row k={sub.settled ? 'Yield share' : 'Yield share so far'} v={money(ys, offer.mintDecimals, sym, 4)} />
          {sub.settled && <Row k="Receipts" v={`${units(Number(sub.allottedUnits))} ${offer.symbol}`} />}
        </dl>
        {open && (
          <button className="btn btn-ghost mt-5 w-full" onClick={leave} disabled={state.status === 'signing' || state.status === 'sending'}>
            Withdraw commitment
          </button>
        )}
        <TxNote state={state} />
      </div>
    )
  }

  return (
    <div className="card p-6">
      <p className="mono text-xs uppercase tracking-[0.2em] text-mute">Subscribe</p>
      {!open && <p className="mt-3 text-paper-2">{offer.status === 'open' && now < offer.openTs ? `Opens ${dateLabel(offer.openTs)}.` : 'This book is closed.'}</p>}
      {open && (
        <>
          <label className="mt-4 block text-sm text-paper-2">Units</label>
          <div className="mt-2 flex items-center gap-2">
            <button className="btn btn-ghost h-12 w-12 p-0" onClick={() => setRaw(String(Math.max(0, Number(raw || 0) - Number(offer.minUnits))))}>−</button>
            <input inputMode="numeric" className="field tabular text-center text-xl" value={raw} onChange={(e) => setRaw(e.target.value.replace(/[^0-9]/g, ''))} placeholder={offer.minUnits.toString()} />
            <button className="btn btn-ghost h-12 w-12 p-0" onClick={() => setRaw(String(Number(raw || 0) + Number(offer.minUnits)))}>+</button>
          </div>
          <dl className="mt-5 space-y-2 text-sm">
            <Row k="You commit" v={money(amount, offer.mintDecimals, sym)} />
            <Row k="If the book closed now" v={`${units(Number(projected))} units`} />
            <Row k="Likely refund" v={money(amount - projected * offer.unitPrice, offer.mintDecimals, sym)} />
          </dl>
          {tooLow && <p className="mt-3 text-xs text-danger">Minimum is {offer.minUnits.toString()} units.</p>}
          {tooHigh && <p className="mt-3 text-xs text-danger">Maximum is {offer.maxUnits.toString()} units.</p>}
          <Faucet refresh={state.status} mint={offer.mint} />
          <Eligibility offer={offer} onChange={setAttestation} />
          {!publicKey ? (
            <p className="mt-5 text-sm text-mute">Connect a wallet to commit.</p>
          ) : (
            <button className="btn btn-signal mt-5 w-full" disabled={n === 0n || tooLow || tooHigh || (Boolean(offer.gate) && !attestation) || state.status === 'signing' || state.status === 'sending'} onClick={commit}>
              {state.status === 'signing' ? 'Sign in your wallet' : state.status === 'sending' ? 'Settling' : `Commit ${money(amount, offer.mintDecimals, sym)}`}
            </button>
          )}
          <TxNote state={state} />
        </>
      )}
    </div>
  )
}

function Operations({ offer, closable, pending, reload }: { offer: Offer; closable: boolean; pending: Subscription[]; reload: () => void }) {
  const { publicKey } = useWallet()
  const program = useProgram()
  const { send, state, reset } = useSend()
  const config = useConfig()
  const [progress, setProgress] = useState<string | null>(null)
  const isIssuer = publicKey && publicKey.equals(offer.issuer)
  const allotted = offer.status !== 'open' && offer.processed === offer.subscriberCount
  const canFinalize = allotted && offer.status !== 'settled'

  const landed = state.status === 'done' ? state.sig : null
  useEffect(() => {
    if (landed) reload()
  }, [landed, reload])

  async function close() {
    if (!publicKey) return
    reset()
    await send([...(await recallIxs(program, offer, publicKey)), await closeOfferIx(program, offer)])
  }

  async function cancel() {
    if (!publicKey) return
    reset()
    await send([...(await recallIxs(program, offer, publicKey)), await cancelOfferIx(program, offer)])
  }

  async function runAllotment() {
    if (!publicKey) return
    reset()
    const batches: Subscription[][] = []
    for (let i = 0; i < pending.length; i += 4) batches.push(pending.slice(i, i + 4))
    for (let i = 0; i < batches.length; i++) {
      setProgress(`Batch ${i + 1} of ${batches.length}`)
      const ixs = await Promise.all(batches[i].map((s) => allotIx(program, offer, s.subscriber, publicKey)))
      const sig = await send(ixs)
      if (!sig) break
    }
    setProgress(null)
    reload()
  }

  async function finalize() {
    if (!publicKey || !config) return
    reset()
    await send([await finalizeIx(program, offer, config.feeDestination, publicKey)])
  }

  const nothing = offer.status === 'settled' || (!closable && offer.status === 'open' && !isIssuer)
  if (nothing) return null

  return (
    <div className="card p-6">
      <p className="mono text-xs uppercase tracking-[0.2em] text-mute">Run the book</p>
      <p className="mt-2 text-sm text-paper-2">These steps are permissionless. Anyone can run them, and the result is the same whoever does.</p>
      {(offer.status !== 'open' || closable) && <Faucet refresh={state.status} mint={offer.mint} />}
      <div className="mt-4 space-y-2">
        {closable && (
          <button className="btn btn-primary w-full" onClick={close} disabled={!publicKey || busy(state)}>
            Close the book
          </button>
        )}
        {offer.status !== 'open' && pending.length > 0 && (
          <button className="btn btn-primary w-full" onClick={runAllotment} disabled={!publicKey || busy(state)}>
            {progress ?? `Allot ${pending.length} subscription${pending.length === 1 ? '' : 's'}`}
          </button>
        )}
        {canFinalize && (
          <button className="btn btn-primary w-full" onClick={finalize} disabled={!publicKey || busy(state)}>
            Pay the issuer
          </button>
        )}
        {isIssuer && offer.status === 'open' && (
          <button className="btn btn-ghost w-full" onClick={cancel} disabled={busy(state)}>
            Cancel the offer
          </button>
        )}
      </div>
      <TxNote state={state} />
    </div>
  )
}

function Settlement({ offer, sym }: { offer: Offer; sym: string }) {
  const proceeds = offer.success ? offer.unitsAllotted * offer.unitPrice : 0n
  const fee = (proceeds * BigInt(offer.feeBps)) / 10_000n
  const returned = offer.principal - offer.loss - proceeds
  const rows: [string, string][] = [
    ['Paid to the issuer', money(proceeds - fee, offer.mintDecimals, sym)],
    ['Returned to subscribers', money(returned > 0n ? returned : 0n, offer.mintDecimals, sym)],
    ['Yield paid out', money(offer.yieldPaid, offer.mintDecimals, sym, 4)],
    ['Receipts minted', `${units(Number(offer.unitsAllotted))} ${offer.symbol}`],
    ['Protocol fee', money(fee, offer.mintDecimals, sym)],
  ]
  return (
    <div className="card p-6">
      <p className="mono text-xs uppercase tracking-[0.2em] text-mute">{offer.success ? 'Settled' : 'Refunded in full'}</p>
      <dl className="mt-4 space-y-2 text-sm">
        {rows.map(([k, v], i) => (
          <motion.div
            key={k}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.12 * i }}
            className="flex items-center justify-between border-b border-line pb-2 last:border-0"
          >
            <dt className="text-paper-2">{k}</dt>
            <dd className="tabular text-paper">{v}</dd>
          </motion.div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-mute">The vault is empty. Every figure above is read from the offer account.</p>
    </div>
  )
}

async function recallIxs(program: ReturnType<typeof useProgram>, offer: Offer, who: PublicKey, asSubscriber = false): Promise<TransactionInstruction[]> {
  if (offer.inStrategy === 0n) return []
  return [ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }), await unsweepIx(program, offer, who, asSubscriber)]
}

function busy(state: { status: string }) {
  return state.status === 'signing' || state.status === 'sending'
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-2">
      <dt className="text-mute">{k}</dt>
      <dd className="tabular">{v}</dd>
    </div>
  )
}

export function TxNote({ state }: { state: { status: string; sig?: string; message?: string } }) {
  return (
    <AnimatePresence>
      {state.status === 'done' && (
        <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-xs text-mint">
          Settled.{' '}
          <a className="underline" href={explorer(state.sig ?? '')} target="_blank" rel="noreferrer">
            View transaction
          </a>
        </motion.p>
      )}
      {state.status === 'error' && (
        <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-xs text-danger">
          {state.message}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

