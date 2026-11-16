import { createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token'
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'

const GAS = 0.02 * LAMPORTS_PER_SOL
const COOLDOWN = 60_000

const recent = new Map<string, number>()

type Env = Record<string, string | undefined>

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export async function drip(env: Env, request: Request): Promise<Response> {
  const secret = env.FAUCET_KEY
  const rpc = env.RPC_URL ?? env.VITE_RPC_URL
  const listed = (env.FAUCET_MINTS ?? (env.VITE_MINT ? `${env.VITE_MINT}:USDC:6` : '')).split(',').filter(Boolean).map((e) => e.split(':'))
  if (!secret || !rpc || listed.length === 0) return json({ error: 'The faucet is not set up here.' }, 503)
  if (rpc.includes('mainnet')) return json({ error: 'No faucet on mainnet.' }, 403)

  let wallet: PublicKey
  let chosen = listed[0]
  try {
    const body = (await request.json()) as { wallet: string; mint?: string }
    wallet = new PublicKey(body.wallet)
    if (body.mint) chosen = listed.find((m) => m[0] === body.mint) ?? chosen
  } catch {
    return json({ error: 'Send a wallet address.' }, 400)
  }
  const decimals = BigInt(10) ** BigInt(chosen[2] ?? '6')
  const DRIP = (chosen[1] === 'cNGN' ? 5_000_000n : 5_000n) * decimals
  const CAP = DRIP * 4n
  const id = wallet.toBase58() + ':' + chosen[0]
  if (Date.now() - (recent.get(id) ?? 0) < COOLDOWN) return json({ error: 'Give it a minute before asking again.' }, 429)

  const connection = new Connection(rpc, 'confirmed')
  const faucet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret) as number[]))
  const mint = new PublicKey(chosen[0])
  const account = getAssociatedTokenAddressSync(mint, wallet, true)
  const [held, lamports] = await Promise.all([
    connection.getTokenAccountBalance(account).then((b) => BigInt(b.value.amount), () => 0n),
    connection.getBalance(wallet),
  ])
  if (held >= CAP) return json({ error: 'This wallet already holds plenty.' }, 429)

  recent.set(id, Date.now())
  const needsGas = lamports < GAS / 2
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(faucet.publicKey, account, wallet, mint),
    createMintToInstruction(mint, account, faucet.publicKey, DRIP),
  )
  if (needsGas) tx.add(SystemProgram.transfer({ fromPubkey: faucet.publicKey, toPubkey: wallet, lamports: GAS }))
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
    tx.recentBlockhash = blockhash
    tx.feePayer = faucet.publicKey
    tx.sign(faucet)
    const signature = await connection.sendRawTransaction(tx.serialize(), { preflightCommitment: 'confirmed', maxRetries: 3 })
    for (let i = 1; ; i++) {
      await new Promise((r) => setTimeout(r, 800))
      const status = (await connection.getSignatureStatuses([signature])).value[0]
      if (status?.err) throw new Error('failed')
      if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') break
      if (i % 6 === 0 && (await connection.getBlockHeight('confirmed')) > lastValidBlockHeight) throw new Error('expired')
    }
    return json({ signature, amount: DRIP.toString(), symbol: chosen[1], gas: needsGas })
  } catch {
    recent.delete(id)
    return json({ error: 'The faucet could not send right now.' }, 502)
  }
}

export function POST(request: Request): Promise<Response> {
  return drip(process.env, request)
}
