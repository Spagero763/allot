import type { Wallet } from '@coral-xyz/anchor'
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction, type TransactionInstruction, type VersionedTransaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { getProgram } from 'allot-sdk'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const RPC_URL = process.env.RPC_URL ?? 'http://127.0.0.1:8899'
export const CLUSTER = RPC_URL.includes('devnet') ? 'devnet' : RPC_URL.includes('mainnet') ? 'mainnet' : 'localnet'

export const connection = new Connection(RPC_URL, 'confirmed')

export function loadKeypair(path = process.env.KEYPAIR ?? join(homedir(), '.config/solana/id.json')): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, 'utf8'))))
}

export function programFor(signer: Keypair) {
  const wallet = {
    publicKey: signer.publicKey,
    payer: signer,
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T) => {
      if (tx instanceof Transaction) tx.partialSign(signer)
      else tx.sign([signer])
      return tx
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]) => {
      for (const tx of txs) {
        if (tx instanceof Transaction) tx.partialSign(signer)
        else tx.sign([signer])
      }
      return txs
    },
  }
  return getProgram(connection, wallet as unknown as Wallet)
}

export async function send(ixs: TransactionInstruction[], payer: Keypair, signers: Keypair[] = [], units = 400_000): Promise<string> {
  const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units }), ...ixs)
  return sendAndConfirmTransaction(connection, tx, [payer, ...signers.filter((s) => !s.publicKey.equals(payer.publicKey))], { commitment: 'confirmed' })
}

export async function chainNow(): Promise<number> {
  const slot = await connection.getSlot('confirmed')
  const t = await connection.getBlockTime(slot)
  return t ?? Math.floor(Date.now() / 1000)
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const stateDir = join(dirname(fileURLToPath(import.meta.url)), '..', '.state')

export interface State {
  mint?: string
  mintAuthority?: number[]
  treasury?: string
  subscribers?: number[][]
  offers?: Record<string, string>
}

export function readState(): State {
  const file = join(stateDir, `${CLUSTER}.json`)
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as State) : {}
}

export function writeState(state: State) {
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(join(stateDir, `${CLUSTER}.json`), JSON.stringify(state, null, 2))
}

export function keyOf(bytes: number[]): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(bytes))
}

export function pk(s: string): PublicKey {
  return new PublicKey(s)
}
