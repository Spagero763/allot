import { AccountRole, address, createNoopSigner, type Address, type Instruction } from '@solana/kit'
import { getCreateAttestationInstruction } from '@solana/attestation'
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'

const SAS = new PublicKey('22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG')
const CREDENTIAL_NAME = 'Allot KYC'
const SCHEMA_NAME = 'kyc'
const COOLDOWN = 60_000
const recent = new Map<string, number>()

type Env = Record<string, string | undefined>
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const seed = (s: string) => new TextEncoder().encode(s)
const addr = (k: PublicKey): Address => address(k.toBase58())

function toWeb3(ix: Instruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programAddress),
    keys: (ix.accounts ?? []).map((a) => ({
      pubkey: new PublicKey(a.address),
      isSigner: a.role === AccountRole.READONLY_SIGNER || a.role === AccountRole.WRITABLE_SIGNER,
      isWritable: a.role === AccountRole.WRITABLE || a.role === AccountRole.WRITABLE_SIGNER,
    })),
    data: Buffer.from(ix.data ?? new Uint8Array()),
  })
}

export async function verify(env: Env, request: Request): Promise<Response> {
  const secret = env.FAUCET_KEY
  const rpc = env.RPC_URL ?? env.VITE_RPC_URL
  if (!secret || !rpc) return json({ error: 'Verification is not set up here.' }, 503)
  if (rpc.includes('mainnet')) return json({ error: 'No demo verification on mainnet.' }, 403)

  let wallet: PublicKey
  try {
    wallet = new PublicKey(((await request.json()) as { wallet: string }).wallet)
  } catch {
    return json({ error: 'Send a wallet address.' }, 400)
  }
  const id = wallet.toBase58()
  if (Date.now() - (recent.get(id) ?? 0) < COOLDOWN) return json({ error: 'Give it a minute before asking again.' }, 429)

  const connection = new Connection(rpc, 'confirmed')
  const authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret) as number[]))
  const credential = PublicKey.findProgramAddressSync([seed('credential'), authority.publicKey.toBytes(), seed(CREDENTIAL_NAME)], SAS)[0]
  const schema = PublicKey.findProgramAddressSync([seed('schema'), credential.toBytes(), seed(SCHEMA_NAME), new Uint8Array([1])], SAS)[0]
  const attestation = PublicKey.findProgramAddressSync([seed('attestation'), credential.toBytes(), schema.toBytes(), wallet.toBytes()], SAS)[0]
  if (await connection.getAccountInfo(attestation)) return json({ attestation: attestation.toBase58(), already: true })

  recent.set(id, Date.now())
  const country = seed('NG')
  const data = new Uint8Array(4 + country.length + 1)
  new DataView(data.buffer).setUint32(0, country.length, true)
  data.set(country, 4)
  data[4 + country.length] = 1

  const ix = toWeb3(
    getCreateAttestationInstruction({
      payer: createNoopSigner(addr(authority.publicKey)),
      authority: createNoopSigner(addr(authority.publicKey)),
      credential: addr(credential),
      schema: addr(schema),
      attestation: addr(attestation),
      systemProgram: addr(SystemProgram.programId),
      nonce: addr(wallet),
      data,
      expiry: 0,
    }),
  )
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
    const tx = new Transaction({ feePayer: authority.publicKey, recentBlockhash: blockhash }).add(ix)
    tx.sign(authority)
    const signature = await connection.sendRawTransaction(tx.serialize(), { preflightCommitment: 'confirmed', maxRetries: 3 })
    for (let i = 1; ; i++) {
      await new Promise((r) => setTimeout(r, 800))
      const status = (await connection.getSignatureStatuses([signature])).value[0]
      if (status?.err) throw new Error('failed')
      if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') break
      if (i % 6 === 0 && (await connection.getBlockHeight('confirmed')) > lastValidBlockHeight) throw new Error('expired')
    }
    return json({ attestation: attestation.toBase58(), signature })
  } catch {
    recent.delete(id)
    return json({ error: 'Verification could not be recorded right now.' }, 502)
  }
}

export function POST(request: Request): Promise<Response> {
  return verify(process.env, request)
}
