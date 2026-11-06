import { createAssociatedTokenAccountIdempotentInstruction, createInitializeMint2Instruction, createMintToInstruction, getAssociatedTokenAddressSync, getMinimumBalanceForRentExemptMint, MINT_SIZE, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from '@solana/web3.js'
import { CLUSTER, confirm, connection, send } from './env'

export const DECIMALS = 6
export const usd = (n: number) => BigInt(Math.round(n * 10 ** DECIMALS))

export async function createMint(payer: Keypair, authority: Keypair): Promise<PublicKey> {
  const mint = Keypair.generate()
  const lamports = await getMinimumBalanceForRentExemptMint(connection)
  await send(
    [
      SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey, space: MINT_SIZE, lamports, programId: TOKEN_PROGRAM_ID }),
      createInitializeMint2Instruction(mint.publicKey, DECIMALS, authority.publicKey, null),
    ],
    payer,
    [mint],
  )
  return mint.publicKey
}

export async function mintTo(payer: Keypair, mint: PublicKey, authority: Keypair, owner: PublicKey, amount: bigint) {
  const ata = getAssociatedTokenAddressSync(mint, owner, true)
  await send(
    [createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, owner, mint), createMintToInstruction(mint, ata, authority.publicKey, amount)],
    payer,
    [authority],
  )
}

export async function balanceOf(mint: PublicKey, owner: PublicKey, programId = TOKEN_PROGRAM_ID): Promise<bigint> {
  const ata = getAssociatedTokenAddressSync(mint, owner, true, programId)
  const info = await connection.getTokenAccountBalance(ata).catch(() => null)
  return info ? BigInt(info.value.amount) : 0n
}

export async function giveSol(payer: Keypair, to: PublicKey, sol: number) {
  if (CLUSTER === 'localnet') {
    const { lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
    await confirm(await connection.requestAirdrop(to, sol * LAMPORTS_PER_SOL), lastValidBlockHeight)
    return
  }
  await send([SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: to, lamports: Math.round(sol * LAMPORTS_PER_SOL) })], payer)
}
