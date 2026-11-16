import { AccountRole, address, createNoopSigner, type Address, type Instruction } from '@solana/kit'
import { getCreateAttestationInstruction, getCreateCredentialInstruction, getCreateSchemaInstruction } from '@solana/attestation'
import { Keypair, PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js'
import { attestationPda, credentialPda, schemaPda } from 'allot-sdk'
import { connection, send } from './env'

export const CREDENTIAL_NAME = 'Allot KYC'
export const SCHEMA_NAME = 'kyc'

const encoder = new TextEncoder()

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

const addr = (k: PublicKey): Address => address(k.toBase58())

export function kycData(country: string, tier: number): Uint8Array {
  const c = encoder.encode(country)
  const out = new Uint8Array(4 + c.length + 1)
  new DataView(out.buffer).setUint32(0, c.length, true)
  out.set(c, 4)
  out[4 + c.length] = tier
  return out
}

export async function ensureKycSchema(authority: Keypair): Promise<{ credential: PublicKey; schema: PublicKey }> {
  const credential = credentialPda(authority.publicKey, CREDENTIAL_NAME)
  const schema = schemaPda(credential, SCHEMA_NAME)
  const ixs: TransactionInstruction[] = []
  if (!(await connection.getAccountInfo(credential))) {
    ixs.push(
      toWeb3(
        getCreateCredentialInstruction({
          payer: createNoopSigner(addr(authority.publicKey)),
          credential: addr(credential),
          authority: createNoopSigner(addr(authority.publicKey)),
          systemProgram: addr(SystemProgram.programId),
          name: CREDENTIAL_NAME,
          signers: [addr(authority.publicKey)],
        }),
      ),
    )
  }
  if (!(await connection.getAccountInfo(schema))) {
    ixs.push(
      toWeb3(
        getCreateSchemaInstruction({
          payer: createNoopSigner(addr(authority.publicKey)),
          authority: createNoopSigner(addr(authority.publicKey)),
          credential: addr(credential),
          schema: addr(schema),
          systemProgram: addr(SystemProgram.programId),
          name: SCHEMA_NAME,
          description: 'Identity checked by the issuer. country is ISO 3166-1 alpha-2, tier 1 is retail and tier 2 is professional.',
          layout: [12, 0],
          fieldNames: ['country', 'tier'],
        }),
      ),
    )
  }
  if (ixs.length) await send(ixs, authority)
  return { credential, schema }
}

export async function attestWallet(authority: Keypair, credential: PublicKey, schema: PublicKey, subject: PublicKey, country = 'NG', tier = 1, expiry = 0): Promise<PublicKey> {
  const attestation = attestationPda(credential, schema, subject)
  if (await connection.getAccountInfo(attestation)) return attestation
  await send(
    [
      toWeb3(
        getCreateAttestationInstruction({
          payer: createNoopSigner(addr(authority.publicKey)),
          authority: createNoopSigner(addr(authority.publicKey)),
          credential: addr(credential),
          schema: addr(schema),
          attestation: addr(attestation),
          systemProgram: addr(SystemProgram.programId),
          nonce: addr(subject),
          data: kycData(country, tier),
          expiry,
        }),
      ),
    ],
    authority,
  )
  return attestation
}
