import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction, type TransactionInstruction } from '@solana/web3.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchOffer, fetchOffers, fetchSubscription, fetchSubscriptionsBy, fetchSubscriptionsOf, getProgram, strategyValue, type Offer, type Subscription } from 'allot-sdk'
import type { Wallet } from '@coral-xyz/anchor'

export function useProgram() {
  const { connection } = useConnection()
  const wallet = useAnchorWallet()
  return useMemo(() => getProgram(connection, wallet as Wallet | undefined), [connection, wallet])
}

export function useNow(tick = 1000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), tick)
    return () => clearInterval(id)
  }, [tick])
  return now
}

export function useOffers(poll = 8000) {
  const program = useProgram()
  const [offers, setOffers] = useState<Offer[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      setOffers(await fetchOffers(program))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [program])
  useEffect(() => {
    load()
    const id = setInterval(load, poll)
    return () => clearInterval(id)
  }, [load, poll])
  return { offers, error, reload: load }
}

export function useOffer(key: string | undefined, poll = 4000) {
  const program = useProgram()
  const [offer, setOffer] = useState<Offer | null | undefined>(undefined)
  const [subs, setSubs] = useState<Subscription[]>([])
  const load = useCallback(async () => {
    if (!key) return
    try {
      const pk = new PublicKey(key)
      const [o, s] = await Promise.all([fetchOffer(program, pk), fetchSubscriptionsOf(program, pk)])
      setOffer(o)
      setSubs(s)
    } catch {
      setOffer(null)
    }
  }, [program, key])
  useEffect(() => {
    load()
    const id = setInterval(load, poll)
    return () => clearInterval(id)
  }, [load, poll])
  return { offer, subs, reload: load }
}

export function useMySubscription(offer: Offer | null | undefined) {
  const program = useProgram()
  const { publicKey } = useWallet()
  const [sub, setSub] = useState<Subscription | null>(null)
  const load = useCallback(async () => {
    if (!offer || !publicKey) {
      setSub(null)
      return
    }
    setSub(await fetchSubscription(program, offer.key, publicKey))
  }, [program, offer, publicKey])
  useEffect(() => {
    load()
  }, [load])
  return { sub, reload: load }
}

export function useMySubscriptions() {
  const program = useProgram()
  const { publicKey } = useWallet()
  const [subs, setSubs] = useState<Subscription[] | null>(null)
  const load = useCallback(async () => {
    if (!publicKey) {
      setSubs(null)
      return
    }
    setSubs(await fetchSubscriptionsBy(program, publicKey))
  }, [program, publicKey])
  useEffect(() => {
    load()
  }, [load])
  return { subs, reload: load }
}

export function useEarning(offer: Offer, poll = 6000): { earned: number; perSecond: number } | null {
  const program = useProgram()
  const samples = useRef<{ at: number; value: number }[]>([])
  const [, bump] = useState(0)
  const key = offer.key.toBase58()
  const lent = Number(offer.inStrategy)
  useEffect(() => {
    samples.current = []
    if (lent === 0) return
    let live = true
    const read = async () => {
      const value = await strategyValue(program, offer).catch(() => null)
      if (!live || value === null) return
      const sample = { at: performance.now(), value: Number(value) }
      samples.current = [samples.current[0] ?? sample, sample]
      bump((n) => n + 1)
    }
    read()
    const id = setInterval(read, poll)
    const frame = setInterval(() => bump((n) => n + 1), 250)
    return () => {
      live = false
      clearInterval(id)
      clearInterval(frame)
    }
  }, [program, key, lent, poll])
  const [first, last] = [samples.current[0], samples.current[samples.current.length - 1]]
  if (!last) return null
  const perSecond = first && last.at > first.at ? Math.max(0, ((last.value - first.value) / (last.at - first.at)) * 1000) : 0
  const value = last.value + (perSecond * (performance.now() - last.at)) / 1000
  return { earned: Math.max(0, value - lent), perSecond }
}

export type TxState = { status: 'idle' } | { status: 'signing' } | { status: 'sending' } | { status: 'done'; sig: string } | { status: 'error'; message: string }

export function useSend() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const [state, setState] = useState<TxState>({ status: 'idle' })
  const busy = useRef(false)
  const send = useCallback(
    async (ixs: TransactionInstruction[]) => {
      if (!publicKey || busy.current) return null
      busy.current = true
      try {
        setState({ status: 'signing' })
        const tx = new Transaction().add(...ixs)
        tx.feePayer = publicKey
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
        tx.recentBlockhash = blockhash
        const sig = await sendTransaction(tx, connection, { preflightCommitment: 'confirmed' })
        setState({ status: 'sending' })
        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
        setState({ status: 'done', sig })
        return sig
      } catch (e) {
        setState({ status: 'error', message: friendly((e as Error).message) })
        return null
      } finally {
        busy.current = false
      }
    },
    [connection, publicKey, sendTransaction],
  )
  const reset = useCallback(() => setState({ status: 'idle' }), [])
  return { send, state, reset }
}

function friendly(message: string): string {
  const m = message.match(/Error Message: ([^.]+)\./)
  if (m) return m[1]
  if (message.includes('User rejected')) return 'You cancelled the signature'
  if (message.includes('insufficient')) return 'Not enough balance'
  return message.length > 140 ? message.slice(0, 140) + '…' : message
}
