import { allotment, type Offer, type Subscription } from 'allot-sdk'
import type { BookData } from '@/ui/BookVisual'
import { short } from './format'

export function bookOf(offer: Offer, subs: Subscription[], currency = 'USDC'): BookData {
  return {
    name: offer.name,
    symbol: offer.symbol,
    total: Number(offer.totalUnits),
    price: Number(offer.unitPrice) / 10 ** offer.mintDecimals,
    currency,
    segs: top(subs).map((s) => ({
      id: s.key.toBase58(),
      label: short(s.subscriber.toBase58(), 3),
      requested: Number(s.units),
      allotted: Number(s.settled ? s.allottedUnits : offer.status === 'open' || offer.success ? allotment(offer, s.units) : 0n),
    })),
  }
}

const requests = [120_000, 85_000, 200, 64_000, 1_500, 150_000, 90, 42_000, 180_000]
const names = ['7xKp…3fQ', 'Ade…w9L', 'Chi…2mT', 'Bex…k8R', 'Tun…e4Z', 'Hal…p1N', 'Ngo…s7V', 'Ife…c5D', 'Zar…u6H']

export function sampleBook(): BookData {
  const total = 250_000
  const floor = 200
  const requested = requests.reduce((a, b) => a + b, 0)
  const floorDemand = requests.reduce((a, r) => a + Math.min(r, floor), 0)
  const alloc = (r: number) => {
    const g = Math.min(r, floor)
    return g + Math.floor(((r - g) * (total - floorDemand)) / (requested - floorDemand))
  }
  return {
    name: 'Kuramo Terminals Series A',
    symbol: 'KTA',
    total,
    price: 1,
    currency: 'USDC',
    segs: requests.map((r, i) => ({ id: `s${i}`, label: names[i], requested: r, allotted: alloc(r) })),
  }
}

function top(subs: Subscription[], max = 48): Subscription[] {
  if (subs.length <= max) return subs
  return [...subs].sort((a, b) => (b.units > a.units ? 1 : -1)).slice(0, max)
}

export function previewBook(name: string, symbol: string, total: number, price: number, floor: number, currency = 'USDC'): BookData {
  const scale = total > 0 ? total / 250_000 : 0
  const scaled = requests.map((r) => Math.max(1, Math.round(r * scale)))
  const requested = scaled.reduce((a, b) => a + b, 0)
  const floorDemand = scaled.reduce((a, r) => a + Math.min(r, floor), 0)
  const usable = floor > 0 && floorDemand <= total
  const alloc = (r: number) => {
    if (requested <= total) return r
    if (!usable) return Math.floor((r * total) / requested)
    const g = Math.min(r, floor)
    return g + Math.floor(((r - g) * (total - floorDemand)) / (requested - floorDemand))
  }
  return {
    name: name || 'Your offer',
    symbol: symbol || 'UNIT',
    total,
    price,
    currency,
    segs: scaled.map((r, i) => ({ id: `p${i}`, label: names[i], requested: r, allotted: alloc(r) })),
  }
}
