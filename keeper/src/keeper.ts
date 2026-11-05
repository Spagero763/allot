import { allotIx, closeOfferIx, configPda, fetchOffers, fetchSubscriptionsOf, finalizeIx, type Offer } from 'allot-sdk'
import { chainNow, loadKeypair, programFor, send, sleep } from './env'

const BATCH = 5
const INTERVAL = Number(process.env.INTERVAL_MS ?? 4000)

const keeper = loadKeypair()
const program = programFor(keeper)

export async function work(offer: Offer, now: number): Promise<string[]> {
  const done: string[] = []
  if (offer.status === 'open') {
    if (now < offer.closeTs) return done
    await send([await closeOfferIx(program, offer)], keeper)
    done.push('closed')
    return done
  }
  if (offer.status === 'settled') return done

  const pending = (await fetchSubscriptionsOf(program, offer.key)).filter((s) => !s.settled)
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH)
    const ixs = await Promise.all(batch.map((s) => allotIx(program, offer, s.subscriber, keeper.publicKey)))
    await send(ixs, keeper, [], 1_000_000)
    done.push(`allotted ${batch.length}`)
  }
  if (pending.length === 0 && offer.processed === offer.subscriberCount) {
    const config = await program.account.config.fetch(configPda())
    await send([await finalizeIx(program, offer, config.feeDestination, keeper.publicKey)], keeper)
    done.push('settled')
  }
  return done
}

export async function tick() {
  const now = await chainNow()
  const offers = await fetchOffers(program)
  for (const offer of offers) {
    try {
      const done = await work(offer, now)
      if (done.length) console.log(new Date().toISOString(), offer.symbol, offer.key.toBase58().slice(0, 8), done.join(', '))
    } catch (e) {
      console.error(offer.symbol, (e as Error).message.split('\n')[0])
    }
  }
}

if (process.argv[1]?.endsWith('keeper.ts')) {
  console.log('keeper', keeper.publicKey.toBase58())
  for (;;) {
    await tick().catch((e) => console.error((e as Error).message))
    await sleep(INTERVAL)
  }
}
