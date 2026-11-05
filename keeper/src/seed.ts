import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { LEND, configPda, createOfferIx, fetchOffer, offerPda, subscribeIx, subscriptionPda, type Strategy } from 'allot-sdk'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CLUSTER, RPC_URL, chainNow, connection, keyOf, loadKeypair, pk, programFor, readState, send, sleep, writeState } from './env'
import { work } from './keeper'
import { createMint, giveSol, mintTo, usd } from './tokens'

const payer = loadKeypair()
const program = programFor(payer)
const state = readState()
const fundArg = process.argv.indexOf('--fund')

if (!(await program.account.config.fetchNullable(configPda()))) {
  await send(
    [await program.methods.initConfig(50, payer.publicKey).accountsStrict({ admin: payer.publicKey, config: configPda(), systemProgram: SystemProgram.programId }).instruction()],
    payer,
  )
  console.log('config created')
}

const forked = process.env.MINT
if (forked && state.mint !== forked) {
  state.mint = forked
  state.mintAuthority = [...payer.secretKey]
  state.subscribers = undefined
  state.offers = {}
  writeState(state)
}
const lends = Boolean(forked) && Boolean((await connection.getAccountInfo(LEND.lending))?.executable)

if (!state.mint || !(await connection.getAccountInfo(pk(state.mint)))) {
  const authority = Keypair.generate()
  state.mint = (await createMint(payer, authority)).toBase58()
  state.mintAuthority = [...authority.secretKey]
  state.subscribers = undefined
  state.offers = {}
  writeState(state)
  console.log('mint', state.mint)
}
const mint = pk(state.mint)
const authority = keyOf(state.mintAuthority!)

const here = dirname(fileURLToPath(import.meta.url))
if (!authority.publicKey.equals(payer.publicKey) && (await connection.getBalance(authority.publicKey)) < 0.5 * 1e9) {
  await giveSol(payer, authority.publicKey, CLUSTER === 'localnet' ? 5 : 1.5)
}
mkdirSync(join(here, '..', '.state'), { recursive: true })
writeFileSync(join(here, '..', '.state', `faucet-${CLUSTER}.json`), JSON.stringify([...authority.secretKey]), { mode: 0o600 })

if (fundArg > 0) {
  const who = new PublicKey(process.argv[fundArg + 1])
  const amount = Number(process.argv[fundArg + 2] ?? 5000)
  await mintTo(payer, mint, authority, who, usd(amount))
  if (CLUSTER === 'localnet') await giveSol(payer, who, 2)
  console.log(`funded ${who.toBase58()} with ${amount} test USDC`)
  process.exit(0)
}

if (!state.subscribers) {
  const keys = Array.from({ length: 12 }, () => Keypair.generate())
  for (const k of keys) {
    await giveSol(payer, k.publicKey, 0.03)
    await mintTo(payer, mint, authority, k.publicKey, usd(2_000_000))
  }
  state.subscribers = keys.map((k) => [...k.secretKey])
  writeState(state)
  console.log('subscribers funded', keys.length)
}
const subscribers = state.subscribers.map(keyOf)

if (!state.treasury) {
  state.treasury = Keypair.generate().publicKey.toBase58()
  writeState(state)
}
const treasury = pk(state.treasury)

interface Book {
  slug: string
  name: string
  symbol: string
  price: number
  units: bigint
  min: bigint
  floor: bigint
  minRaise: bigint
  seconds: number
  requests: bigint[]
  strategy?: Strategy
}

const day = 60 * 60 * 24
const local = CLUSTER === 'localnet'

const books: Book[] = [
  { slug: 'kta', name: 'Kuramo Terminals Series A', symbol: 'KTA', price: 1, units: 250_000n, min: 10n, floor: 200n, minRaise: 0n, seconds: local ? 6 * 60 * 60 : 30 * day, requests: [120_000n, 85_000n, 200n, 64_000n, 1_500n, 150_000n, 90n, 42_000n, 180_000n], strategy: lends ? 'jupiterLend' : 'idle' },
  { slug: 'sgn', name: 'Savannah Grid Notes 2028', symbol: 'SGN', price: 5, units: 40_000n, min: 5n, floor: 20n, minRaise: 10_000n, seconds: local ? 3 * day : 45 * day, requests: [6_000n, 20n, 4_500n, 1_200n] },
  { slug: 'acf', name: 'Adire Collective Fund I', symbol: 'ACF', price: 2, units: 20_000n, min: 10n, floor: 100n, minRaise: 0n, seconds: 16, requests: [9_000n, 14_000n, 100n, 6_500n, 7_000n, 50n] },
  { slug: 'mcc', name: 'Mangrove Cold Chain', symbol: 'MCC', price: 10, units: 8_000n, min: 1n, floor: 0n, minRaise: 6_000n, seconds: 16, requests: [900n, 350n, 1_100n] },
]

state.offers ??= {}
const short: PublicKey[] = []
for (const book of books) {
  if (state.offers[book.slug] && (await connection.getAccountInfo(pk(state.offers[book.slug])))) continue
  const now = await chainNow()
  const offerId = BigInt(Date.now())
  const key = offerPda(payer.publicKey, offerId)
  await send(
    [
      await createOfferIx(program, payer.publicKey, {
        offerId,
        mint,
        unitPrice: usd(book.price),
        totalUnits: book.units,
        minUnits: book.min,
        maxUnits: 0n,
        floorUnits: book.floor,
        minRaiseUnits: book.minRaise,
        openTs: now - 1,
        closeTs: now + book.seconds,
        treasury,
        strategy: book.strategy ?? 'idle',
        name: book.name,
        symbol: book.symbol,
        uri: '',
      }),
    ],
    payer,
  )
  state.offers[book.slug] = key.toBase58()
  writeState(state)
  const offer = (await fetchOffer(program, key))!
  for (const [i, units] of book.requests.entries()) {
    const s = subscribers[i % subscribers.length]
    if (await connection.getAccountInfo(subscriptionPda(key, s.publicKey))) continue
    await send([await subscribeIx(programFor(s), offer, s.publicKey, units)], s)
  }
  console.log(book.symbol, key.toBase58(), `${book.requests.length} subscriptions`)
  if (book.seconds < 120) short.push(key)
  else {
    const done = await work((await fetchOffer(program, key))!, await chainNow())
    if (done.length) console.log(book.symbol, done.join(', '))
  }
}

for (const key of short) {
  for (;;) {
    const offer = (await fetchOffer(program, key))!
    if (offer.status === 'settled') break
    const done = await work(offer, await chainNow())
    if (done.length) console.log(offer.symbol, done.join(', '))
    else await sleep(1500)
  }
}

if (CLUSTER !== 'mainnet') {
  const lines = [`VITE_CLUSTER=${CLUSTER}`, `VITE_RPC_URL=${RPC_URL}`, `VITE_MINT=${mint.toBase58()}`, 'VITE_MINT_DECIMALS=6', 'VITE_MINT_SYMBOL=USDC']
  if (local) lines.push(`FAUCET_KEY=${JSON.stringify([...authority.secretKey])}`)
  const env = [...lines, ''].join('\n')
  const file = join(here, '..', '..', 'app', local ? '.env.development.local' : '.env.production.local')
  writeFileSync(file, env)
  console.log('wrote', file)
}
console.log('seeded')
