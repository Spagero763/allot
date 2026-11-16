import { PublicKey } from '@solana/web3.js'

export interface MintInfo {
  mint: PublicKey
  symbol: string
  decimals: number
}

const listed = ((import.meta.env.VITE_MINTS as string | undefined) ?? '')
  .split(',')
  .filter(Boolean)
  .map((entry) => {
    const [mint, symbol, decimals] = entry.split(':')
    return { mint: new PublicKey(mint), symbol, decimals: Number(decimals) }
  })

export const DEFAULT_MINT = new PublicKey((import.meta.env.VITE_MINT as string | undefined) ?? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')
export const DEFAULT_MINT_DECIMALS = Number(import.meta.env.VITE_MINT_DECIMALS ?? 6)
export const DEFAULT_MINT_SYMBOL = (import.meta.env.VITE_MINT_SYMBOL as string | undefined) ?? 'USDC'
export const KYC_SCHEMA = import.meta.env.VITE_KYC_SCHEMA ? new PublicKey(import.meta.env.VITE_KYC_SCHEMA as string) : null

export const MINTS: MintInfo[] = listed.length ? listed : [{ mint: DEFAULT_MINT, symbol: DEFAULT_MINT_SYMBOL, decimals: DEFAULT_MINT_DECIMALS }]

export function mintInfo(mint: PublicKey, decimals = 6): MintInfo {
  return MINTS.find((m) => m.mint.equals(mint)) ?? { mint, symbol: 'UNIT', decimals }
}
