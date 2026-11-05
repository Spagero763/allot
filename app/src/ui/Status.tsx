import type { Offer } from 'allot-sdk'

export function Status({ offer }: { offer: Offer }) {
  const label =
    offer.status === 'open' ? 'open' : offer.status === 'settled' ? 'settled' : offer.status === 'cancelled' ? 'cancelled' : offer.success ? 'allotting' : 'failed'
  const tone =
    label === 'open' ? 'bg-mint/15 text-mint' : label === 'settled' ? 'bg-paper/10 text-paper' : label === 'allotting' ? 'bg-gold/15 text-gold' : 'bg-danger/15 text-danger'
  return <span className={`mono rounded-full px-3 py-1 text-xs uppercase tracking-wider ${tone}`}>{label}</span>
}
