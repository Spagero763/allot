export function units(n: number | bigint): string {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(Number(n))
}

export function money(base: bigint | number, decimals: number, symbol = 'USDC', maxFrac = 2): string {
  const v = Number(base) / 10 ** decimals
  const s = new Intl.NumberFormat('en', { minimumFractionDigits: v < 1 && v > 0 ? Math.min(6, maxFrac + 2) : 0, maximumFractionDigits: v < 1 && v > 0 ? Math.min(6, maxFrac + 2) : maxFrac }).format(v)
  return `${s} ${symbol}`
}

export function compact(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function pct(part: number, whole: number): number {
  if (whole === 0) return 0
  return (part / whole) * 100
}

export function coverage(requested: number, total: number): string {
  if (total === 0) return '0.0x'
  return `${(requested / total).toFixed(2)}x`
}

export function short(key: string, n = 4): string {
  return key.length <= n * 2 + 1 ? key : `${key.slice(0, n)}…${key.slice(-n)}`
}

export function countdown(target: number, now: number): { label: string; done: boolean; parts: [number, number, number, number] } {
  const diff = Math.max(0, target - now)
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = Math.floor(diff % 60)
  const label = diff === 0 ? 'closed' : d > 0 ? `${d}d ${h}h ${m}m` : `${pad(h)}:${pad(m)}:${pad(s)}`
  return { label, done: diff === 0, parts: [d, h, m, s] }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

export function dateLabel(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function explorer(sig: string, cluster = 'devnet'): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=${cluster}`
}

export function explorerAddress(addr: string, cluster = 'devnet'): string {
  return `https://explorer.solana.com/address/${addr}?cluster=${cluster}`
}
