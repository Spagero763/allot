import assert from 'node:assert/strict'
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import { Keypair, SystemProgram } from '@solana/web3.js'
import { allotIx, allotment, closeOfferIx, configPda, createOfferIx, fetchOffer, fetchSubscription, finalizeIx, offerPda, subscribeIx } from 'allot-sdk'
import { CLUSTER, chainNow, connection, loadKeypair, programFor, send, sleep } from './env'
import { balanceOf, createMint, giveSol, mintTo, usd } from './tokens'

const payer = loadKeypair()
const program = programFor(payer)
const log = (label: string, value: unknown) => console.log(label.padEnd(22), value)

console.log('cluster', CLUSTER, 'program', program.programId.toBase58())

const config = await program.account.config.fetchNullable(configPda())
if (!config) {
  const sig = await send(
    [await program.methods.initConfig(50, payer.publicKey).accountsStrict({ admin: payer.publicKey, config: configPda(), systemProgram: SystemProgram.programId }).instruction()],
    payer,
  )
  log('init_config', sig)
}
const { feeDestination, feeBps } = await program.account.config.fetch(configPda())

const authority = Keypair.generate()
const mint = await createMint(payer, authority)
const treasury = Keypair.generate().publicKey
log('mint', mint.toBase58())

const now = await chainNow()
const offerId = BigInt(Date.now())
const offerKey = offerPda(payer.publicKey, offerId)
const window = CLUSTER === 'localnet' ? 25 : 90
log(
  'create_offer',
  await send(
    [
      await createOfferIx(program, payer.publicKey, {
        offerId,
        mint,
        unitPrice: usd(1),
        totalUnits: 1_000n,
        minUnits: 1n,
        maxUnits: 0n,
        floorUnits: 100n,
        minRaiseUnits: 0n,
        openTs: now - 1,
        closeTs: now + window,
        treasury,
        strategy: 'idle',
        name: 'Harbour Terminals A',
        symbol: 'HTA',
        uri: '',
      }),
    ],
    payer,
  ),
)

const requests = [100n, 2_000n, 400n]
const subscribers = requests.map(() => Keypair.generate())
for (const [i, s] of subscribers.entries()) {
  await giveSol(payer, s.publicKey, 0.05)
  await mintTo(payer, mint, authority, s.publicKey, usd(Number(requests[i])))
  const offer = (await fetchOffer(program, offerKey))!
  log(`subscribe ${requests[i]}`, await send([await subscribeIx(programFor(s), offer, s.publicKey, requests[i])], s))
}

let offer = (await fetchOffer(program, offerKey))!
assert.equal(offer.unitsRequested, 2_500n)
assert.equal(offer.floorDemand, 300n)
const expected = requests.map((r) => allotment(offer, r))
log('expected allotment', expected.join(', '))

while ((await chainNow()) < offer.closeTs) await sleep(1000)
log('close_offer', await send([await closeOfferIx(program, offer)], payer))
offer = (await fetchOffer(program, offerKey))!
assert.equal(offer.status, 'closed')
assert.equal(offer.success, true)

log(
  'allot x3',
  await send(await Promise.all(subscribers.map((s) => allotIx(program, offer, s.publicKey, payer.publicKey))), payer, [], 1_000_000),
)
for (const [i, s] of subscribers.entries()) {
  const sub = (await fetchSubscription(program, offerKey, s.publicKey))!
  assert.equal(sub.settled, true)
  assert.equal(sub.allottedUnits, expected[i])
  assert.equal(await balanceOf(offer.receiptMint, s.publicKey, TOKEN_2022_PROGRAM_ID), expected[i])
  assert.equal(await balanceOf(mint, s.publicKey), usd(Number(requests[i] - expected[i])))
}

offer = (await fetchOffer(program, offerKey))!
log('finalize', await send([await finalizeIx(program, offer, feeDestination, payer.publicKey)], payer))
offer = (await fetchOffer(program, offerKey))!
assert.equal(offer.status, 'settled')
const proceeds = offer.unitsAllotted * offer.unitPrice
const fee = (proceeds * BigInt(feeBps)) / 10_000n
assert.equal(await balanceOf(mint, treasury), proceeds - fee)
assert.equal(await balanceOf(mint, offerKey), 0n)

log('units allotted', offer.unitsAllotted)
log('treasury received', proceeds - fee)
log('protocol fee', fee)
console.log('ok')
await connection.getSlot()
