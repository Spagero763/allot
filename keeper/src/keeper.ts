import { LEND, allotIx, closeOfferIx, configPda, fetchOffer, fetchOffers, fetchSubscriptionsOf, finalizeIx, lendAccounts, sweepIx, unsweepIx, vaultOf, type Offer } from 'allot-sdk'
import { chainNow, connection, loadKeypair, programFor, send, sleep } from './env'

const BATCH = 5
const INTERVAL = Number(process.env.INTERVAL_MS ?? 4000)

const TARGET_RESERVE_BPS = 1_500n
const MIN_SWEEP_BPS = 500n
const MIN_RUNWAY = 60 * 60

const keeper = loadKeypair()
const program = programFor(keeper)

const markets = new Map<string, boolean>()
async function canLend(mint: Offer['mint']): Promise<boolean> {
  const key = mint.toBase58()
  if (!markets.has(key)) {
    const program = Boolean((await connection.getAccountInfo(LEND.lending))?.executable)
    markets.set(key, program && Boolean(await connection.getAccountInfo(lendAccounts(mint).lending)))
  }
  return markets.get(key)!
}

async function sweepIdle(offer: Offer, now: number): Promise<string | null> {
  if (offer.strategy !== 'jupiterLend' || offer.closeTs - now < MIN_RUNWAY || !(await canLend(offer.mint))) return null
  const idle = BigInt((await connection.getTokenAccountBalance(vaultOf(offer))).value.amount)
  const amount = idle - (offer.principal * TARGET_RESERVE_BPS) / 10_000n
  if (amount <= 0n || amount < (offer.principal * MIN_SWEEP_BPS) / 10_000n) return null
  await send([await sweepIx(program, offer, keeper.publicKey, amount)], keeper, [], 600_000)
  return `swept ${amount}`
}

export async function work(offer: Offer, now: number): Promise<string[]> {
  const done: string[] = []
  if (offer.status === 'open') {
    if (now < offer.closeTs) {
      const swept = await sweepIdle(offer, now)
      if (swept) done.push(swept)
      return done
    }
    if (offer.inStrategy > 0n) {
      await send([await unsweepIx(program, offer, keeper.publicKey)], keeper, [], 600_000)
      done.push('recalled')
      offer = (await fetchOffer(program, offer.key))!
    }
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
  if (process.argv.includes('--once')) {
    await tick()
    process.exit(0)
  }
  for (;;) {
    await tick().catch((e) => console.error((e as Error).message))
    await sleep(INTERVAL)
  }
}
