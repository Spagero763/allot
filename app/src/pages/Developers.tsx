import { PROGRAM_ID } from 'allot-sdk'
import { explorerAddress } from '@/lib/format'
import { Page, Reveal } from '@/ui/motion'

const snippet = `import { Connection, PublicKey } from '@solana/web3.js'
import { getProgram, fetchOffers, subscribeIx } from 'allot-sdk'

const connection = new Connection('https://api.devnet.solana.com')
const program = getProgram(connection, wallet)

const [offer] = await fetchOffers(program)
const ix = await subscribeIx(program, offer, wallet.publicKey, 250n)
await wallet.sendTransaction(new Transaction().add(ix), connection)`

const accounts = [
  ['Config', '["config"]', 'fee in basis points, fee destination, pause flag'],
  ['Offer', '["offer", issuer, offer_id]', 'terms, totals, result, receipt mint'],
  ['Subscription', '["sub", offer, subscriber]', 'request, amount, weight, allotment, refund, yield'],
  ['Receipt mint', '["receipt", offer]', 'Token-2022, zero decimals, metadata on the mint'],
]

const instructions = [
  ['create_offer', 'issuer', 'opens the book, creates vault and receipt mint'],
  ['subscribe', 'subscriber', 'moves units × price into the vault'],
  ['cancel_subscription', 'subscriber', 'returns the principal while the book is open'],
  ['sweep', 'issuer or admin', 'lends idle vault balance on Jupiter, keeping a reserve'],
  ['unsweep', 'issuer, subscriber, or anyone at close', 'redeems the whole position back to the vault'],
  ['close_offer', 'anyone', 'after the close; records yield and whether the raise succeeded'],
  ['allot', 'anyone', 'per subscription; refund, yield share and receipts in one transaction'],
  ['finalize', 'anyone', 'fee to the protocol, proceeds to the treasury'],
  ['cancel_offer', 'issuer', 'treats the book as failed; everyone is refunded'],
]

export function Developers() {
  return (
    <Page className="mx-auto max-w-6xl px-4 pt-10 md:px-6 md:pt-16">
      <Reveal>
        <p className="mono text-xs uppercase tracking-[0.2em] text-mute">Developers</p>
        <h1 className="display mt-2 text-5xl md:text-6xl">Put a book in your app</h1>
        <p className="mt-4 max-w-2xl text-paper-2">
          The program is open source and permissionless. A broker, a wallet or a registrar can open offers and let its own users subscribe without touching this site.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <p className="mono text-xs uppercase tracking-[0.2em] text-mute">Program</p>
          <a className="mono mt-2 block break-all text-paper hover:underline" href={explorerAddress(PROGRAM_ID.toBase58())} target="_blank" rel="noreferrer">
            {PROGRAM_ID.toBase58()}
          </a>
          <p className="mt-6 mono text-xs uppercase tracking-[0.2em] text-mute">Accounts</p>
          <ul className="mt-3 space-y-3 text-sm">
            {accounts.map(([n, s, d]) => (
              <li key={n} className="border-b border-line pb-3">
                <span className="text-paper">{n}</span> <span className="mono text-mute">{s}</span>
                <p className="text-paper-2">{d}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <p className="mono text-xs uppercase tracking-[0.2em] text-mute">Instructions</p>
          <ul className="mt-3 space-y-3 text-sm">
            {instructions.map(([n, who, d]) => (
              <li key={n} className="border-b border-line pb-3">
                <span className="mono text-paper">{n}</span> <span className="text-mute">· {who}</span>
                <p className="text-paper-2">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card mt-6 p-6">
        <p className="mono text-xs uppercase tracking-[0.2em] text-mute">Client</p>
        <pre className="mono mt-3 overflow-x-auto rounded-2xl bg-ink p-5 text-sm leading-6 text-paper-2">{snippet}</pre>
      </div>
    </Page>
  )
}
