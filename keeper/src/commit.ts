import { Keypair } from '@solana/web3.js'
import { fetchOffer, subscribeIx } from 'allot-sdk'
import { pk, programFor, send } from './env'

const [offer, units] = process.argv.slice(2)
if (!offer || !units || !process.env.WALLET) throw new Error('usage: WALLET=<secret key json> commit.ts <offer> <units>')
const wallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.WALLET) as number[]))
const program = programFor(wallet)
const book = (await fetchOffer(program, pk(offer)))!
console.log(await send([await subscribeIx(program, book, wallet.publicKey, BigInt(units))], wallet))
