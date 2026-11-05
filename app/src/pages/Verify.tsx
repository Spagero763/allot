import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PublicKey } from '@solana/web3.js'
import { useProgram } from '@/lib/hooks'
import { allotment, fetchOffer, fetchSubscription, yieldShare, type Offer, type Subscription } from 'allot-sdk'
import { explorerAddress, money, short, units } from '@/lib/format'
import { Page, Reveal } from '@/ui/motion'

export function Verify() {
  const { offer: offerKey, subscriber } = useParams()
  const program = useProgram()
  const [offer, setOffer] = useState<Offer | null>(null)
  const [sub, setSub] = useState<Subscription | null>(null)

  useEffect(() => {
    if (!offerKey || !subscriber) return
    const o = new PublicKey(offerKey)
    const s = new PublicKey(subscriber)
    fetchOffer(program, o).then(setOffer)
    fetchSubscription(program, o, s).then(setSub)
  }, [program, offerKey, subscriber])

  if (!offer || !sub) return <Page className="mx-auto max-w-4xl px-4 py-20 md:px-6"><div className="card h-80 animate-pulse" /></Page>

  const U = offer.totalUnits
  const R = offer.unitsRequested
  const f = offer.floorUnits
  const G = offer.floorDemand
  const r = sub.units
  const g = r < f ? r : f
  const over = R > U
  const floorOk = f > 0n && G <= U
  const computed = allotment(offer, r)
  const matches = !sub.settled || computed === sub.allottedUnits
  const ys = yieldShare(offer, sub.weight)
  const sym = offer.mintDecimals === 6 ? 'USDC' : 'units'

  return (
    <Page className="mx-auto max-w-4xl px-4 pt-10 md:px-6 md:pt-16">
      <Link to={`/o/${offer.key.toBase58()}`} className="mono text-xs uppercase tracking-[0.2em] text-mute hover:text-paper">← {offer.name}</Link>
      <Reveal>
        <h1 className="display mt-4 text-5xl md:text-6xl">Check this allotment</h1>
        <p className="mt-4 max-w-2xl text-paper-2">
          Every number below is read from the offer account on chain. The formula is fixed in the program. Recompute it yourself and it has to come out the same.
        </p>
      </Reveal>

      <div className="card mt-8 p-6 md:p-8">
        <p className="mono text-xs uppercase tracking-[0.2em] text-mute">Subscriber</p>
        <a className="mono mt-1 block break-all text-paper hover:underline" href={explorerAddress(sub.subscriber.toBase58())} target="_blank" rel="noreferrer">
          {sub.subscriber.toBase58()}
        </a>

        <h2 className="display mt-8 text-3xl">Inputs</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
          <Val k="U, units offered" v={units(Number(U))} />
          <Val k="R, units requested" v={units(Number(R))} />
          <Val k="f, floor per subscriber" v={units(Number(f))} />
          <Val k="G, floor demand" v={units(Number(G))} />
          <Val k="r, this request" v={units(Number(r))} />
          <Val k="g = min(r, f)" v={units(Number(g))} />
        </dl>

        <h2 className="display mt-8 text-3xl">Steps</h2>
        <ol className="mono mt-4 space-y-3 text-sm">
          {!over && (
            <li>
              R ≤ U, so the book is not oversubscribed. <b className="text-paper">a = r = {units(Number(r))}</b>
            </li>
          )}
          {over && !floorOk && (
            <>
              <li>R &gt; U, the book is oversubscribed.{f > 0n && <> The floor cannot be honoured because G &gt; U, so it is ignored.</>}</li>
              <li>
                a = floor(r × U / R) = floor({units(Number(r))} × {units(Number(U))} / {units(Number(R))}) = <b className="text-paper">{units(Number(computed))}</b>
              </li>
            </>
          )}
          {over && floorOk && (
            <>
              <li>R &gt; U, the book is oversubscribed. The floor is honoured first.</li>
              <li>
                remaining supply = U − G = {units(Number(U - G))}, remaining demand = R − G = {units(Number(R - G))}
              </li>
              <li>
                extra = floor((r − g) × (U − G) / (R − G)) = {units(Number(computed - g))}
              </li>
              <li>
                a = g + extra = <b className="text-paper">{units(Number(computed))}</b>
              </li>
            </>
          )}
          <li>
            refund = amount − a × price = {money(sub.amount, offer.mintDecimals, sym)} − {units(Number(computed))} × {money(offer.unitPrice, offer.mintDecimals, sym)} ={' '}
            <b className="text-paper">{money(sub.amount - computed * offer.unitPrice, offer.mintDecimals, sym)}</b>
          </li>
          <li>
            yield share = yield × weight / total weight = <b className="text-paper">{money(ys, offer.mintDecimals, sym, 6)}</b>
          </li>
        </ol>

        <div className={`mt-8 rounded-2xl border p-5 ${matches ? 'border-mint/40 bg-mint/5' : 'border-danger/40 bg-danger/5'}`}>
          {sub.settled ? (
            matches ? (
              <p className="text-mint">Matches what the program paid out: {units(Number(sub.allottedUnits))} units, {money(sub.refund, offer.mintDecimals, sym)} refunded, {money(sub.yieldShare, offer.mintDecimals, sym, 6)} earned.</p>
            ) : (
              <p className="text-danger">Does not match the recorded allotment. This should never happen.</p>
            )
          ) : (
            <p className="text-paper-2">The book is still open, so this is what {short(sub.subscriber.toBase58())} would receive if it closed now.</p>
          )}
        </div>
      </div>
    </Page>
  )
}

function Val({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-mute">{k}</dt>
      <dd className="tabular mt-1 text-paper">{v}</dd>
    </div>
  )
}
