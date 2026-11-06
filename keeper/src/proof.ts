import { fetchOffer } from 'allot-sdk'
import { connection, loadKeypair, pk, programFor, readState, sleep } from './env'

const program = programFor(loadKeypair())
const state = readState()
const wanted = ['CreateOffer', 'Subscribe', 'CloseOffer', 'Allot', 'Finalize']

for (const key of Object.values(state.offers ?? {})) {
  const offer = await fetchOffer(program, pk(key))
  if (!offer) continue
  console.log(`\n${offer.symbol} ${offer.name} | ${offer.status}${offer.status !== 'open' ? (offer.success ? ' (filled)' : ' (refunded)') : ''} | ${key}`)
  console.log(`  requested ${offer.unitsRequested} of ${offer.totalUnits}, allotted ${offer.unitsAllotted}, subscribers ${offer.subscriberCount}`)
  const seen = new Set<string>()
  const signatures = (await connection.getSignaturesForAddress(pk(key), { limit: 40 })).reverse()
  for (const { signature } of signatures) {
    if (seen.size === wanted.length) break
    await sleep(450)
    const tx = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' })
    const logs = tx?.meta?.logMessages ?? []
    for (const name of wanted) {
      if (seen.has(name) || !logs.some((l) => l === `Program log: Instruction: ${name}`)) continue
      seen.add(name)
      const count = logs.filter((l) => l === `Program log: Instruction: ${name}`).length
      console.log(`  ${name}${count > 1 ? ` x${count}` : ''}  ${signature}`)
    }
  }
}
console.log(`\nmint ${state.mint}  treasury ${state.treasury}`)
