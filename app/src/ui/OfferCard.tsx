import { Link } from 'react-router-dom'
import type { Offer } from 'allot-sdk'
import { coverage, countdown, money, units } from '@/lib/format'
import { mintInfo } from '@/lib/mints'
import { Digits, Spotlight } from './fx'
import { Bar } from './motion'
import { Status } from './Status'

export function OfferCard({ offer, now }: { offer: Offer; now: number }) {
  const cd = countdown(offer.closeTs, now)
  const requested = Number(offer.unitsRequested)
  const total = Number(offer.totalUnits)
  const raise = offer.totalUnits * offer.unitPrice
  return (
    <Spotlight className="card h-full">
      <Link to={`/o/${offer.key.toBase58()}`} className="group block h-full p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mono text-xs uppercase tracking-[0.2em] text-mute">{offer.symbol}</p>
            <h3 className="display mt-1 text-3xl transition-transform duration-500 ease-out group-hover:translate-x-1">{offer.name}</h3>
          </div>
          <Status offer={offer} />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-mute">Raise</p>
            <p className="tabular mt-1">{money(raise, offer.mintDecimals, mintInfo(offer.mint, offer.mintDecimals).symbol)}</p>
          </div>
          <div>
            <p className="text-mute">Unit</p>
            <p className="tabular mt-1">{money(offer.unitPrice, offer.mintDecimals, mintInfo(offer.mint, offer.mintDecimals).symbol)}</p>
          </div>
          <div>
            <p className="text-mute">{offer.status === 'open' ? 'Closes in' : 'Covered'}</p>
            <p className="mono mt-1">{offer.status === 'open' ? <Digits value={cd.label} /> : coverage(requested, total)}</p>
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
        <div className="mt-5 flex items-center justify-between text-xs text-mute">
          <span>{offer.subscriberCount} subscribers</span>
          <span className="flex items-center gap-1 text-paper transition-transform duration-500 ease-out group-hover:translate-x-1">
            Open the book <span aria-hidden>→</span>
          </span>
        </div>
      </Link>
    </Spotlight>
  )
}
