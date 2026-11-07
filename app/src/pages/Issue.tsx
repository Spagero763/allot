import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { createOfferIx, offerPda, type Strategy } from 'allot-sdk'
import { useNow, useOffers, useProgram, useSend } from '@/lib/hooks'
import { DEFAULT_MINT, DEFAULT_MINT_DECIMALS, DEFAULT_MINT_SYMBOL } from '@/lib/mints'
import { money, units } from '@/lib/format'
import { Page, Reveal } from '@/ui/motion'
import { TxNote } from './Offer'
import { OfferCard } from '@/ui/OfferCard'

export function Issue() {
  const { publicKey } = useWallet()
  const program = useProgram()
  const { send, state, reset } = useSend()
  const { offers, reload } = useOffers()
  const now = useNow()
  const mine = (offers ?? []).filter((o) => publicKey && o.issuer.equals(publicKey))

  const [form, setForm] = useState({
    name: '',
    symbol: '',
    uri: '',
    unitPrice: '1',
    totalUnits: '100000',
    minUnits: '10',
    maxUnits: '0',
    floorUnits: '100',
    minRaiseUnits: '0',
    opensIn: '0',
    duration: '60',
    treasury: '',
    strategy: 'idle' as Strategy,
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const parsed = useMemo(() => {
    const price = BigInt(Math.round(Number(form.unitPrice || 0) * 10 ** DEFAULT_MINT_DECIMALS))
    return {
      unitPrice: price,
      totalUnits: BigInt(form.totalUnits || 0),
      minUnits: BigInt(form.minUnits || 1),
      maxUnits: BigInt(form.maxUnits || 0),
      floorUnits: BigInt(form.floorUnits || 0),
      minRaiseUnits: BigInt(form.minRaiseUnits || 0),
      openTs: now + Number(form.opensIn || 0) * 60,
      closeTs: now + Number(form.opensIn || 0) * 60 + Number(form.duration || 0) * 60,
    }
  }, [form])
  const raise = parsed.unitPrice * parsed.totalUnits
  const valid =
    form.name.length > 0 && form.name.length <= 32 && form.symbol.length > 0 && form.symbol.length <= 10 && form.uri.length <= 128 && parsed.unitPrice > 0n && parsed.totalUnits > 0n && parsed.minUnits >= 1n && parsed.floorUnits <= parsed.totalUnits && parsed.minRaiseUnits <= parsed.totalUnits && Number(form.duration) > 0

  const landed = state.status === 'done' ? state.sig : null
  useEffect(() => {
    if (landed) reload()
  }, [landed, reload])

  async function create() {
    if (!publicKey) return
    reset()
    let treasury: PublicKey
    try {
      treasury = form.treasury ? new PublicKey(form.treasury) : publicKey
    } catch {
      return
    }
    const offerId = BigInt(Date.now())
    const ix = await createOfferIx(program, publicKey, {
      offerId,
      mint: DEFAULT_MINT,
      ...parsed,
      treasury,
      strategy: form.strategy,
      name: form.name,
      symbol: form.symbol.toUpperCase(),
      uri: form.uri,
    })
    const sig = await send([ix])
    if (sig) setCreated(offerPda(publicKey, offerId).toBase58())
  }
  const [created, setCreated] = useState<string | null>(null)

  return (
    <Page className="mx-auto max-w-6xl px-4 pt-10 md:px-6 md:pt-16">
      <Reveal>
        <p className="mono text-xs uppercase tracking-[0.2em] text-mute">Issuer console</p>
        <h1 className="display mt-2 text-5xl md:text-6xl">Open a book</h1>
        <p className="mt-4 max-w-2xl text-paper-2">
          Set the terms once. After the book opens nothing can be changed, not by you and not by us. Subscribers see the same account you do.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-8 md:grid-cols-12">
        <form
          className="card space-y-6 p-6 md:col-span-7 md:p-8"
          onSubmit={(e) => {
            e.preventDefault()
            create()
          }}
        >
          <Group title="Identity">
            <Field label="Offer name" hint="up to 32 characters">
              <input className="field" value={form.name} onChange={set('name')} placeholder="Kuramo Terminals Series A" maxLength={32} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Receipt symbol" hint="up to 10">
                <input className="field uppercase" value={form.symbol} onChange={set('symbol')} placeholder="KTA" maxLength={10} />
              </Field>
              <Field label="Prospectus URI" hint="optional">
                <input className="field" value={form.uri} onChange={set('uri')} placeholder="https://…" maxLength={128} />
              </Field>
            </div>
          </Group>

          <Group title="Terms">
            <div className="grid grid-cols-2 gap-4">
              <Field label={`Unit price (${DEFAULT_MINT_SYMBOL})`}>
                <input className="field tabular" inputMode="decimal" value={form.unitPrice} onChange={set('unitPrice')} />
              </Field>
              <Field label="Units offered">
                <input className="field tabular" inputMode="numeric" value={form.totalUnits} onChange={set('totalUnits')} />
              </Field>
              <Field label="Minimum per subscriber">
                <input className="field tabular" inputMode="numeric" value={form.minUnits} onChange={set('minUnits')} />
              </Field>
              <Field label="Maximum per subscriber" hint="0 for none">
                <input className="field tabular" inputMode="numeric" value={form.maxUnits} onChange={set('maxUnits')} />
              </Field>
              <Field label="Guaranteed floor" hint="units every subscriber gets first when oversubscribed">
                <input className="field tabular" inputMode="numeric" value={form.floorUnits} onChange={set('floorUnits')} />
              </Field>
              <Field label="Minimum raise" hint="units; below this the book fails and refunds">
                <input className="field tabular" inputMode="numeric" value={form.minRaiseUnits} onChange={set('minRaiseUnits')} />
              </Field>
            </div>
          </Group>

          <Group title="Schedule and money">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Opens in" hint="minutes from now">
                <input className="field tabular" inputMode="numeric" value={form.opensIn} onChange={set('opensIn')} />
              </Field>
              <Field label="Book stays open for" hint="minutes">
                <input className="field tabular" inputMode="numeric" value={form.duration} onChange={set('duration')} />
              </Field>
            </div>
            <Field label="Treasury" hint="where proceeds land; your wallet if empty. A Squads vault works here.">
              <input className="field mono text-sm" value={form.treasury} onChange={set('treasury')} placeholder={publicKey?.toBase58() ?? ''} />
            </Field>
            <Field label="While the book is open">
              <select className="field" value={form.strategy} onChange={set('strategy')}>
                <option value="idle">Keep committed money in the vault</option>
                <option value="jupiterLend">Lend it on Jupiter until close (mainnet)</option>
              </select>
            </Field>
          </Group>

          <div className="rounded-2xl bg-ink-2 p-5 text-sm">
            <div className="flex justify-between">
              <span className="text-mute">Raise</span>
              <span className="tabular">{money(raise, DEFAULT_MINT_DECIMALS, DEFAULT_MINT_SYMBOL)}</span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-mute">Units</span>
              <span className="tabular">{units(Number(parsed.totalUnits))}</span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-mute">Closes</span>
              <span className="tabular">{new Date(parsed.closeTs * 1000).toLocaleString()}</span>
            </div>
          </div>

          {!publicKey ? (
            <p className="text-sm text-mute">Connect the issuer wallet to open a book.</p>
          ) : (
            <button type="submit" className="btn btn-primary w-full" disabled={!valid || state.status === 'signing' || state.status === 'sending'}>
              {state.status === 'signing' ? 'Sign in your wallet' : state.status === 'sending' ? 'Opening' : 'Open the book'}
            </button>
          )}
          <TxNote state={state} />
          {created && (
            <Link to={`/o/${created}`} className="btn btn-ghost w-full">
              View the offer
            </Link>
          )}
        </form>

        <div className="min-w-0 md:col-span-5">
          <h2 className="display text-3xl">Your offers</h2>
          <div className="mt-4 space-y-4">
            {mine.length === 0 && <p className="text-sm text-mute">None yet.</p>}
            {mine.map((o) => (
              <OfferCard key={o.key.toBase58()} offer={o} now={now} />
            ))}
          </div>
        </div>
      </div>
    </Page>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mono mb-2 text-xs uppercase tracking-[0.2em] text-mute">{title}</legend>
      {children}
    </fieldset>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-paper-2">{label}</span>
      {hint && <span className="ml-2 text-xs text-mute">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  )
}
