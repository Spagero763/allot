import assert from 'node:assert/strict'
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { allotIx, closeOfferIx, configPda, createOfferIx, fetchOffer, fetchSubscription, finalizeIx, offerPda, sharesOf, subscribeIx, sweepIx, unsweepIx, vaultOf } from 'allot-sdk'
import { chainNow, connection, loadKeypair, programFor, send, sleep } from './env'
import { balanceOf, giveSol, mintTo, usd } from './tokens'

const USDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const payer = loadKeypair()
const program = programFor(payer)
const log = (label: string, value: unknown) => console.log(label.padEnd(22), value)

if (!(await program.account.config.fetchNullable(configPda()))) {
  await send(
    [await program.methods.initConfig(50, payer.publicKey).accountsStrict({ admin: payer.publicKey, config: configPda(), systemProgram: SystemProgram.programId }).instruction()],
    payer,
  )
}
const { feeDestination } = await program.account.config.fetch(configPda())

const treasury = Keypair.generate().publicKey
const now = await chainNow()
const offerId = BigInt(Date.now())
const offerKey = offerPda(payer.publicKey, offerId)
await send(
  [
    await createOfferIx(program, payer.publicKey, {
      offerId,
      mint: USDC,
      unitPrice: usd(1),
      totalUnits: 2_000_000n,
      minUnits: 1n,
      maxUnits: 0n,
      floorUnits: 0n,
      minRaiseUnits: 0n,
      openTs: now - 1,
      closeTs: now + 45,
      treasury,
      strategy: 'jupiterLend',
      name: 'Harbour Terminals B',
      symbol: 'HTB',
      uri: '',
    }),
  ],
  payer,
)

const requests = [1_800_000n, 1_200_000n]
const subscribers = requests.map(() => Keypair.generate())
for (const [i, s] of subscribers.entries()) {
  await giveSol(payer, s.publicKey, 0.05)
  await mintTo(payer, USDC, payer, s.publicKey, usd(Number(requests[i])))
  const offer = (await fetchOffer(program, offerKey))!
  await send([await subscribeIx(programFor(s), offer, s.publicKey, requests[i])], s)
}

let offer = (await fetchOffer(program, offerKey))!
const amount = (offer.principal * 85n) / 100n
log('sweep', await send([await sweepIx(program, offer, payer.publicKey, amount)], payer, [], 600_000))
offer = (await fetchOffer(program, offerKey))!
assert.equal(offer.inStrategy, amount)
log('in lending market', amount)
log('shares held', (await connection.getTokenAccountBalance(sharesOf(offer))).value.amount)
log('left in vault', (await connection.getTokenAccountBalance(vaultOf(offer))).value.amount)

while ((await chainNow()) < offer.closeTs) await sleep(1000)
const stranger = Keypair.generate()
await giveSol(payer, stranger.publicKey, 0.05)
log('unsweep by anyone', await send([await unsweepIx(programFor(stranger), offer, stranger.publicKey)], stranger, [], 600_000))
offer = (await fetchOffer(program, offerKey))!
assert.equal(offer.inStrategy, 0n)

log('close_offer', await send([await closeOfferIx(program, offer)], payer))
offer = (await fetchOffer(program, offerKey))!
assert.equal(offer.loss, 0n)
assert.ok(offer.yieldTotal > 0n)
log('yield earned', offer.yieldTotal)

await send(await Promise.all(subscribers.map((s) => allotIx(program, offer, s.publicKey, payer.publicKey))), payer, [], 1_000_000)
let paid = 0n
for (const [i, s] of subscribers.entries()) {
  const sub = (await fetchSubscription(program, offerKey, s.publicKey))!
  assert.equal(sub.allottedUnits, (requests[i] * 2n) / 3n)
  assert.ok(sub.yieldShare > 0n)
  assert.equal(await balanceOf(USDC, s.publicKey), sub.refund + sub.yieldShare)
  paid += sub.yieldShare
  log(`subscriber ${i + 1} earned`, sub.yieldShare)
}

offer = (await fetchOffer(program, offerKey))!
await send([await finalizeIx(program, offer, feeDestination, payer.publicKey)], payer)
offer = (await fetchOffer(program, offerKey))!
assert.equal(offer.status, 'settled')
assert.equal(await balanceOf(USDC, offerKey), 0n)
assert.ok(offer.yieldTotal - paid < 2n)
console.log('ok')
