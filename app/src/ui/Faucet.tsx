import { useCallback, useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { AnimatePresence, motion } from 'motion/react'
import { CLUSTER } from '@/lib/config'
import { DEFAULT_MINT, mintInfo } from '@/lib/mints'
import type { PublicKey } from '@solana/web3.js'
import { Digits } from '@/ui/fx'

type State = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; gas: boolean } | { kind: 'error'; message: string }

export function useBalance(refresh: unknown, mint: PublicKey = DEFAULT_MINT) {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [balance, setBalance] = useState<bigint | null>(null)
  const load = useCallback(async () => {
    if (!publicKey) return setBalance(null)
    const account = getAssociatedTokenAddressSync(mint, publicKey, true)
    setBalance(await connection.getTokenAccountBalance(account).then((b) => BigInt(b.value.amount), () => 0n))
  }, [connection, publicKey, mint])
  useEffect(() => {
    load()
  }, [load, refresh])
  return { balance, reload: load }
}

export function Faucet({ refresh, mint = DEFAULT_MINT }: { refresh?: unknown; mint?: PublicKey }) {
  const { publicKey } = useWallet()
  const { balance, reload } = useBalance(refresh, mint)
  const info = mintInfo(mint)
  const [state, setState] = useState<State>({ kind: 'idle' })
  if (!publicKey || balance === null) return null

  async function ask() {
    setState({ kind: 'busy' })
    try {
      const response = await fetch('/api/faucet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: publicKey!.toBase58(), mint: mint.toBase58() }) })
      const body = (await response.json()) as { error?: string; gas?: boolean }
      if (!response.ok) return setState({ kind: 'error', message: body.error ?? 'The faucet did not answer.' })
      await reload()
      setState({ kind: 'done', gas: Boolean(body.gas) })
    } catch {
      setState({ kind: 'error', message: 'The faucet did not answer.' })
    }
  }

  const whole = (Number(balance) / 10 ** info.decimals).toLocaleString('en', { maximumFractionDigits: 2 })
  return (
    <div className="mt-5 rounded-2xl border border-line px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-mute">In your wallet</p>
          <p className="mono mt-1 text-paper">
            <Digits value={whole} /> <span className="text-mute">{info.symbol}</span>
          </p>
        </div>
        {CLUSTER !== 'mainnet' && (
          <button className="btn btn-ghost px-4 py-2 text-xs" onClick={ask} disabled={state.kind === 'busy'}>
            {state.kind === 'busy' ? 'Sending' : `Get test ${info.symbol}`}
          </button>
        )}
      </div>
      <AnimatePresence>
        {state.kind === 'done' && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pt-2 text-xs text-mint">
            Sent{state.gas ? ', with a little SOL for fees' : ''}.
          </motion.p>
        )}
        {state.kind === 'error' && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pt-2 text-xs text-danger">
            {state.message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
