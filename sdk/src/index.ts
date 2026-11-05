import { AnchorProvider, Program, type Idl, type Wallet } from '@coral-xyz/anchor'
import BN from 'bn.js'
import { Connection, PublicKey, SystemProgram, type TransactionInstruction } from '@solana/web3.js'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token'
import idlJson from './idl/allot.json'
import type { Allot } from './idl/allot'

export const PROGRAM_ID = new PublicKey((idlJson as Idl).address)

export type OfferStatus = 'open' | 'closed' | 'cancelled' | 'settled'
export type Strategy = 'idle' | 'jupiterLend'

export interface Offer {
  key: PublicKey
  issuer: PublicKey
  offerId: bigint
  mint: PublicKey
  mintDecimals: number
  receiptMint: PublicKey
  treasury: PublicKey
  feeBps: number
  unitPrice: bigint
  totalUnits: bigint
  minUnits: bigint
  maxUnits: bigint
  floorUnits: bigint
  minRaiseUnits: bigint
  openTs: number
  closeTs: number
  strategy: Strategy
  status: OfferStatus
  success: boolean
  unitsRequested: bigint
  floorDemand: bigint
  principal: bigint
  weightTotal: bigint
  subscriberCount: number
  inStrategy: bigint
  yieldTotal: bigint
  yieldPaid: bigint
  unitsAllotted: bigint
  processed: number
  closedTs: number
  name: string
  symbol: string
  uri: string
}

export interface Subscription {
  key: PublicKey
  offer: PublicKey
  subscriber: PublicKey
  units: bigint
  amount: bigint
  committedTs: number
  weight: bigint
  allottedUnits: bigint
  refund: bigint
  yieldShare: bigint
  settled: boolean
}

const readOnly = {
  publicKey: PublicKey.default,
  signTransaction: async <T,>(t: T) => t,
  signAllTransactions: async <T,>(t: T) => t,
} as unknown as Wallet

export function getProgram(connection: Connection, wallet?: Wallet): Program<Allot> {
  const provider = new AnchorProvider(connection, wallet ?? readOnly, { commitment: 'confirmed' })
  return new Program<Allot>(idlJson as Allot, provider)
}

const enc = new TextEncoder()
const seed = (s: string) => enc.encode(s)

function u64le(n: bigint): Uint8Array {
  const out = new Uint8Array(8)
  new DataView(out.buffer).setBigUint64(0, n, true)
  return out
}

export function configPda(): PublicKey {
  return PublicKey.findProgramAddressSync([seed('config')], PROGRAM_ID)[0]
}

export function offerPda(issuer: PublicKey, offerId: bigint): PublicKey {
  return PublicKey.findProgramAddressSync([seed('offer'), issuer.toBytes(), u64le(offerId)], PROGRAM_ID)[0]
}

export function receiptPda(offer: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([seed('receipt'), offer.toBytes()], PROGRAM_ID)[0]
}

export function subscriptionPda(offer: PublicKey, subscriber: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([seed('sub'), offer.toBytes(), subscriber.toBytes()], PROGRAM_ID)[0]
}

export function vaultOf(offer: Offer): PublicKey {
  return getAssociatedTokenAddressSync(offer.mint, offer.key, true, TOKEN_PROGRAM_ID)
}

type RawOffer = Awaited<ReturnType<Program<Allot>['account']['offer']['fetch']>>
type RawSub = Awaited<ReturnType<Program<Allot>['account']['subscription']['fetch']>>

function enumKey(v: object): string {
  return Object.keys(v)[0]
}

export function decodeOffer(key: PublicKey, o: RawOffer): Offer {
  return {
    key,
    issuer: o.issuer,
    offerId: BigInt(o.offerId.toString()),
    mint: o.mint,
    mintDecimals: o.mintDecimals,
    receiptMint: o.receiptMint,
    treasury: o.treasury,
    feeBps: o.feeBps,
    unitPrice: BigInt(o.unitPrice.toString()),
    totalUnits: BigInt(o.totalUnits.toString()),
    minUnits: BigInt(o.minUnits.toString()),
    maxUnits: BigInt(o.maxUnits.toString()),
    floorUnits: BigInt(o.floorUnits.toString()),
    minRaiseUnits: BigInt(o.minRaiseUnits.toString()),
    openTs: Number(o.openTs),
    closeTs: Number(o.closeTs),
    strategy: enumKey(o.strategy) as Strategy,
    status: enumKey(o.status) as OfferStatus,
    success: o.success,
    unitsRequested: BigInt(o.unitsRequested.toString()),
    floorDemand: BigInt(o.floorDemand.toString()),
    principal: BigInt(o.principal.toString()),
    weightTotal: BigInt(o.weightTotal.toString()),
    subscriberCount: o.subscriberCount,
    inStrategy: BigInt(o.inStrategy.toString()),
    yieldTotal: BigInt(o.yieldTotal.toString()),
    yieldPaid: BigInt(o.yieldPaid.toString()),
    unitsAllotted: BigInt(o.unitsAllotted.toString()),
    processed: o.processed,
    closedTs: Number(o.closedTs),
    name: o.name,
    symbol: o.symbol,
    uri: o.uri,
  }
}

export function decodeSubscription(key: PublicKey, s: RawSub): Subscription {
  return {
    key,
    offer: s.offer,
    subscriber: s.subscriber,
    units: BigInt(s.units.toString()),
    amount: BigInt(s.amount.toString()),
    committedTs: Number(s.committedTs),
    weight: BigInt(s.weight.toString()),
    allottedUnits: BigInt(s.allottedUnits.toString()),
    refund: BigInt(s.refund.toString()),
    yieldShare: BigInt(s.yieldShare.toString()),
    settled: s.settled,
  }
}

export async function fetchOffers(program: Program<Allot>): Promise<Offer[]> {
  const all = await program.account.offer.all()
  return all.map((a) => decodeOffer(a.publicKey, a.account)).sort((a, b) => b.openTs - a.openTs)
}

export async function fetchOffer(program: Program<Allot>, key: PublicKey): Promise<Offer | null> {
  const o = await program.account.offer.fetchNullable(key)
  return o ? decodeOffer(key, o) : null
}

export async function fetchSubscription(program: Program<Allot>, offer: PublicKey, subscriber: PublicKey): Promise<Subscription | null> {
  const key = subscriptionPda(offer, subscriber)
  const s = await program.account.subscription.fetchNullable(key)
  return s ? decodeSubscription(key, s) : null
}

export async function fetchSubscriptionsOf(program: Program<Allot>, offer: PublicKey): Promise<Subscription[]> {
  const all = await program.account.subscription.all([{ memcmp: { offset: 8, bytes: offer.toBase58() } }])
  return all.map((a) => decodeSubscription(a.publicKey, a.account)).sort((a, b) => a.committedTs - b.committedTs)
}

export async function fetchSubscriptionsBy(program: Program<Allot>, subscriber: PublicKey): Promise<Subscription[]> {
  const all = await program.account.subscription.all([{ memcmp: { offset: 40, bytes: subscriber.toBase58() } }])
  return all.map((a) => decodeSubscription(a.publicKey, a.account)).sort((a, b) => b.committedTs - a.committedTs)
}

export function subscribeIx(program: Program<Allot>, offer: Offer, subscriber: PublicKey, units: bigint): Promise<TransactionInstruction> {
  return program.methods
    .subscribe(new BN(units.toString()))
    .accountsStrict({
      subscriber,
      config: configPda(),
      offer: offer.key,
      subscription: subscriptionPda(offer.key, subscriber),
      mint: offer.mint,
      vault: vaultOf(offer),
      subscriberToken: getAssociatedTokenAddressSync(offer.mint, subscriber, true, TOKEN_PROGRAM_ID),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

export function cancelSubscriptionIx(program: Program<Allot>, offer: Offer, subscriber: PublicKey): Promise<TransactionInstruction> {
  return program.methods
    .cancelSubscription()
    .accountsStrict({
      subscriber,
      offer: offer.key,
      subscription: subscriptionPda(offer.key, subscriber),
      mint: offer.mint,
      vault: vaultOf(offer),
      subscriberToken: getAssociatedTokenAddressSync(offer.mint, subscriber, true, TOKEN_PROGRAM_ID),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction()
}

export function closeOfferIx(program: Program<Allot>, offer: Offer): Promise<TransactionInstruction> {
  return program.methods
    .closeOffer()
    .accountsStrict({ offer: offer.key, mint: offer.mint, vault: vaultOf(offer), tokenProgram: TOKEN_PROGRAM_ID })
    .instruction()
}

export function cancelOfferIx(program: Program<Allot>, offer: Offer): Promise<TransactionInstruction> {
  return program.methods
    .cancelOffer()
    .accountsStrict({ issuer: offer.issuer, offer: offer.key, mint: offer.mint, vault: vaultOf(offer), tokenProgram: TOKEN_PROGRAM_ID })
    .instruction()
}

export function allotIx(program: Program<Allot>, offer: Offer, subscriber: PublicKey, payer: PublicKey): Promise<TransactionInstruction> {
  return program.methods
    .allot()
    .accountsStrict({
      payer,
      offer: offer.key,
      subscription: subscriptionPda(offer.key, subscriber),
      subscriber,
      mint: offer.mint,
      vault: vaultOf(offer),
      subscriberToken: getAssociatedTokenAddressSync(offer.mint, subscriber, true, TOKEN_PROGRAM_ID),
      receiptMint: offer.receiptMint,
      subscriberReceipt: getAssociatedTokenAddressSync(offer.receiptMint, subscriber, true, TOKEN_2022_PROGRAM_ID),
      tokenProgram: TOKEN_PROGRAM_ID,
      token2022Program: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

export function finalizeIx(program: Program<Allot>, offer: Offer, feeDestination: PublicKey, payer: PublicKey): Promise<TransactionInstruction> {
  return program.methods
    .finalize()
    .accountsStrict({
      payer,
      offer: offer.key,
      mint: offer.mint,
      vault: vaultOf(offer),
      treasury: offer.treasury,
      treasuryToken: getAssociatedTokenAddressSync(offer.mint, offer.treasury, true, TOKEN_PROGRAM_ID),
      feeDestination,
      feeToken: getAssociatedTokenAddressSync(offer.mint, feeDestination, true, TOKEN_PROGRAM_ID),
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

export interface CreateOfferInput {
  offerId: bigint
  mint: PublicKey
  unitPrice: bigint
  totalUnits: bigint
  minUnits: bigint
  maxUnits: bigint
  floorUnits: bigint
  minRaiseUnits: bigint
  openTs: number
  closeTs: number
  treasury: PublicKey
  strategy: Strategy
  name: string
  symbol: string
  uri: string
}

export function createOfferIx(program: Program<Allot>, issuer: PublicKey, input: CreateOfferInput): Promise<TransactionInstruction> {
  const offer = offerPda(issuer, input.offerId)
  const strategy = input.strategy === 'jupiterLend' ? { jupiterLend: {} } : { idle: {} }
  return program.methods
    .createOffer({
      offerId: new BN(input.offerId.toString()),
      unitPrice: new BN(input.unitPrice.toString()),
      totalUnits: new BN(input.totalUnits.toString()),
      minUnits: new BN(input.minUnits.toString()),
      maxUnits: new BN(input.maxUnits.toString()),
      floorUnits: new BN(input.floorUnits.toString()),
      minRaiseUnits: new BN(input.minRaiseUnits.toString()),
      openTs: new BN(input.openTs),
      closeTs: new BN(input.closeTs),
      treasury: input.treasury,
      strategy,
      name: input.name,
      symbol: input.symbol,
      uri: input.uri,
    })
    .accountsStrict({
      issuer,
      config: configPda(),
      offer,
      mint: input.mint,
      vault: getAssociatedTokenAddressSync(input.mint, offer, true, TOKEN_PROGRAM_ID),
      receiptMint: receiptPda(offer),
      tokenProgram: TOKEN_PROGRAM_ID,
      token2022Program: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

export function allotment(offer: Offer, requested: bigint): bigint {
  const U = offer.totalUnits
  const R = offer.unitsRequested
  if (R <= U) return requested
  const f = offer.floorUnits
  const G = offer.floorDemand
  const guaranteed = requested < f ? requested : f
  if (f === 0n || G > U) return (requested * U) / R
  const remainingSupply = U - G
  const remainingDemand = R - G
  const extra = remainingDemand === 0n ? 0n : ((requested - guaranteed) * remainingSupply) / remainingDemand
  return guaranteed + extra
}

export function yieldShare(offer: Offer, weight: bigint): bigint {
  if (offer.weightTotal === 0n || offer.yieldTotal === 0n) return 0n
  return (offer.yieldTotal * weight) / offer.weightTotal
}
