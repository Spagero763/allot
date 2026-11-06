import { LEND, createOfferIx, fetchOffer, offerPda, subscribeIx, sweepIx } from 'allot-sdk'
import { chainNow, connection, keyOf, loadKeypair, pk, programFor, readState, send } from './env'
import { usd } from './tokens'

const seconds = Number(process.argv[2] ?? 120)
const payer = loadKeypair()
const program = programFor(payer)
const state = readState()
if (!state.mint || !state.subscribers || !state.treasury) throw new Error('run the seed first')

const mint = pk(state.mint)
const subscribers = state.subscribers.map(keyOf)
const lends = mint.toBase58() === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' && Boolean((await connection.getAccountInfo(LEND.lending))?.executable)

const now = await chainNow()
const offerId = BigInt(Date.now())
const key = offerPda(payer.publicKey, offerId)
await send(
  [
    await createOfferIx(program, payer.publicKey, {
      offerId,
      mint,
      unitPrice: usd(1),
      totalUnits: 100_000n,
      minUnits: 10n,
      maxUnits: 0n,
      floorUnits: 100n,
      minRaiseUnits: 0n,
      openTs: now - 1,
      closeTs: now + seconds,
      treasury: pk(state.treasury),
      strategy: lends ? 'jupiterLend' : 'idle',
      name: 'Harmattan Rail Notes',
      symbol: 'HRN',
      uri: '',
    }),
  ],
  payer,
)

const requests = [60_000n, 45_000n, 100n, 30_000n, 52_000n]
let offer = (await fetchOffer(program, key))!
for (const [i, units] of requests.entries()) {
  const s = subscribers[(i + 3) % subscribers.length]
  await send([await subscribeIx(programFor(s), offer, s.publicKey, units)], s)
}

offer = (await fetchOffer(program, key))!
if (lends) await send([await sweepIx(program, offer, payer.publicKey, (offer.principal * 85n) / 100n)], payer, [], 600_000)
console.log(key.toBase58())
