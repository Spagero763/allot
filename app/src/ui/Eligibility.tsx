import { useCallback, useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { AnimatePresence, motion } from 'motion/react'
import { fetchEligibility, type Eligibility as Status, type Offer } from 'allot-sdk'
import type { PublicKey } from '@solana/web3.js'
import { CLUSTER } from '@/lib/config'
import { short } from '@/lib/format'

type Ask = { kind: 'idle' } | { kind: 'busy' } | { kind: 'error'; message: string }

export function Eligibility({ offer, onChange }: { offer: Offer; onChange: (attestation: PublicKey | null) => void }) {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [status, setStatus] = useState<Status | null | undefined>(undefined)
  const [ask, setAsk] = useState<Ask>({ kind: 'idle' })

  const load = useCallback(async () => {
    if (!publicKey || !offer.gate) return setStatus(null)
    const next = await fetchEligibility(connection, offer, publicKey).catch(() => null)
    setStatus(next)
    onChange(next?.attested ? next.attestation : null)
  }, [connection, offer, publicKey, onChange])

  useEffect(() => {
    load()
  }, [load])

  if (!offer.gate || !publicKey) return null

  async function verify() {
    setAsk({ kind: 'busy' })
    try {
      const response = await fetch('/api/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: publicKey!.toBase58() }) })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) return setAsk({ kind: 'error', message: body.error ?? 'Verification did not answer.' })
      await load()
      setAsk({ kind: 'idle' })
    } catch {
      setAsk({ kind: 'error', message: 'Verification did not answer.' })
    }
  }

  const ok = Boolean(status?.attested)
  return (
    <div className={`mt-5 rounded-2xl border px-4 py-3 ${ok ? 'border-mint/25' : 'border-gold/30'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs ${ok ? 'text-mint' : 'text-gold'}`}>{ok ? 'You are eligible' : 'Verified wallets only'}</p>
          <p className="mt-1 text-sm text-paper-2">
            {status === undefined
              ? 'Checking your wallet.'
              : ok
                ? `Attestation ${short(status!.attestation.toBase58())} under “${status!.schemaName}” is on chain and the program will check it when you commit.`
                : `This book needs a “${status?.schemaName ?? 'kyc'}” attestation for your wallet, issued through the Solana Attestation Service. The program refuses commits without it.`}
          </p>
        </div>
        {!ok && status !== undefined && CLUSTER !== 'mainnet' && (
          <button className="btn btn-ghost shrink-0 px-4 py-2 text-xs" onClick={verify} disabled={ask.kind === 'busy'}>
            {ask.kind === 'busy' ? 'Recording' : 'Verify me'}
          </button>
        )}
      </div>
      <AnimatePresence>
        {ask.kind === 'error' && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pt-2 text-xs text-danger">
            {ask.message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
