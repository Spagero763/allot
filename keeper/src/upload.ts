import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'
import { readFileSync } from 'node:fs'
import { connection, loadKeypair, send, sleep } from './env'

const LOADER = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111')
const HEADER = 37
const CHUNK = 900
const PER_SECOND = Number(process.env.RATE ?? 3)

const [file, bufferArg] = process.argv.slice(2)
if (!file || (!bufferArg && !process.env.BUFFER_KEYPAIR)) throw new Error('usage: upload.ts <program.so> <buffer address>  (or BUFFER_KEYPAIR=<path> to create one)')
const program = readFileSync(file)
const authority = loadKeypair()
const bufferKey = process.env.BUFFER_KEYPAIR ? loadKeypair(process.env.BUFFER_KEYPAIR) : null
const buffer = bufferKey ? bufferKey.publicKey : new PublicKey(bufferArg)

if (bufferKey && !(await connection.getAccountInfo(buffer))) {
  const space = HEADER + program.length
  const lamports = await connection.getMinimumBalanceForRentExemption(space)
  const init = new TransactionInstruction({
    programId: LOADER,
    keys: [
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([0, 0, 0, 0]),
  })
  await send([SystemProgram.createAccount({ fromPubkey: authority.publicKey, newAccountPubkey: buffer, lamports, space, programId: LOADER }), init], authority, [bufferKey])
  console.log('buffer created', buffer.toBase58(), 'for', space, 'bytes')
}

function write(offset: number, bytes: Uint8Array): TransactionInstruction {
  const data = Buffer.alloc(4 + 4 + 8 + bytes.length)
  data.writeUInt32LE(1, 0)
  data.writeUInt32LE(offset, 4)
  data.writeBigUInt64LE(BigInt(bytes.length), 8)
  data.set(bytes, 16)
  return new TransactionInstruction({
    programId: LOADER,
    keys: [
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: false },
    ],
    data,
  })
}

async function missing(): Promise<number[]> {
  const info = await connection.getAccountInfo(buffer, 'confirmed')
  if (!info) throw new Error('buffer account not found')
  if (info.data.length < HEADER + program.length) throw new Error('buffer is smaller than the program')
  const onChain = info.data.subarray(HEADER)
  const offsets: number[] = []
  for (let offset = 0; offset < program.length; offset += CHUNK) {
    const want = program.subarray(offset, offset + CHUNK)
    if (!onChain.subarray(offset, offset + want.length).equals(want)) offsets.push(offset)
  }
  return offsets
}

async function retry<T>(fn: () => Promise<T>): Promise<T> {
  for (let wait = 1500; ; wait = Math.min(wait * 2, 20_000)) {
    try {
      return await fn()
    } catch (e) {
      if (!String((e as Error).message).includes('429')) throw e
      await sleep(wait)
    }
  }
}

for (let pass = 1; ; pass++) {
  const offsets = await retry(missing)
  console.log(`pass ${pass}: ${offsets.length} of ${Math.ceil(program.length / CHUNK)} chunks to write`)
  if (offsets.length === 0) break
  let blockhash = (await retry(() => connection.getLatestBlockhash('confirmed'))).blockhash
  let stamped = Date.now()
  for (const [i, offset] of offsets.entries()) {
    if (Date.now() - stamped > 30_000) {
      blockhash = (await retry(() => connection.getLatestBlockhash('confirmed'))).blockhash
      stamped = Date.now()
    }
    const tx = new Transaction({ feePayer: authority.publicKey, recentBlockhash: blockhash }).add(write(offset, program.subarray(offset, offset + CHUNK)))
    tx.sign(authority)
    await retry(() => connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 5 }))
    if ((i + 1) % 50 === 0) console.log(`  sent ${i + 1}`)
    await sleep(1000 / PER_SECOND)
  }
  await sleep(20_000)
}
console.log('buffer matches the program')
