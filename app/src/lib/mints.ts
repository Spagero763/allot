import { PublicKey } from '@solana/web3.js'

export const DEFAULT_MINT = new PublicKey((import.meta.env.VITE_MINT as string | undefined) ?? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')
export const DEFAULT_MINT_DECIMALS = Number(import.meta.env.VITE_MINT_DECIMALS ?? 6)
export const DEFAULT_MINT_SYMBOL = (import.meta.env.VITE_MINT_SYMBOL as string | undefined) ?? 'USDC'
