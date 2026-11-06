# Allot

Primary markets on Solana. An issuer opens a book, people commit stablecoins from their own wallets, and when the book closes the program allots, refunds and pays everyone in one pass that anyone can check.

## The problem

When a public offer is oversubscribed, most of the money sent in has to go back. The Dangote Refinery offer closed about three times oversubscribed, which means roughly two naira in every three that subscribers sent has to be returned.

On the usual rails that return takes weeks. The money earns nothing while it waits, the allotment is worked out where subscribers cannot see it, and a small subscriber has no way to confirm they were treated like a large one.

## What Allot does

- **The book is an account.** Terms are fixed when the offer is created: units, price, per-wallet limits, a guaranteed floor per subscriber, a minimum raise, open and close times. Nobody can change them afterwards, including the issuer and the protocol.
- **Allotment is a formula on chain.** Each subscriber first receives the guaranteed floor, and the rest is shared pro rata. Every input sits on the offer account, so any allotment can be recomputed by hand. The app has a page that does exactly that for any subscriber.
- **Refunds are instant.** One transaction returns the unallotted money, pays the subscriber's share of the yield and mints receipt tokens for the units they received.
- **Waiting money earns.** While the book is open, idle funds can be lent on Jupiter Lend. Yield is split by how much each subscriber committed and for how long.
- **Nothing needs permission to finish.** Closing, allotting and paying the issuer can be called by anyone once the time has passed. If the keeper is offline, any subscriber can settle the book from the app.
- **A failed raise costs subscribers nothing.** If the minimum raise is not met, or the issuer cancels, everyone gets their full commitment back plus yield.

## How a book runs

1. The issuer calls `create_offer`. The program creates the offer, its vault and a Token-2022 receipt mint with metadata on the mint.
2. Subscribers call `subscribe` and can leave with `cancel_subscription` while the book is open.
3. The issuer or the keeper calls `sweep` to lend idle funds, always leaving 10% in the vault so subscribers can leave without waiting. `unsweep` brings everything back.
4. After the close time anyone calls `close_offer`. The program records whether the raise succeeded and how much yield arrived.
5. Anyone calls `allot` for each subscription: allotment, refund, yield share and receipts in a single transaction.
6. Anyone calls `finalize`: the protocol fee comes out of the issuer's proceeds and the rest goes to the issuer's treasury.

The formula, the yield split, the loss rule and the invariants are written out in [docs/protocol.md](docs/protocol.md).

## What has been verified

**Program tests.** `cargo test -p allot` runs 23 tests in a local VM against the compiled program:

- 8 on the allotment, yield, fee and shortfall maths.
- 12 on the full lifecycle, including an oversubscribed book with a floor, a failed raise, a cancelled offer, a subscriber leaving, and two shortfall cases.
- 3 on the lending path, run against the real Jupiter Lend and liquidity programs with a snapshot of their mainnet USDC accounts. In that test 135,000 USDC lent for 30 days returned 604.70 USDC of yield, and every refund, yield share, fee and payout added up to the vault balance exactly.

**End to end through the client.** `pnpm e2e` drives the lifecycle through the TypeScript SDK on a validator: three allotments with refunds and receipts land in one transaction. `pnpm e2e:lend` does the same for the lending path on a local validator that runs the Jupiter programs.

**Safety rules the tests hold in place.**

- An offer cannot close or be cancelled while money is still lent out.
- Only the known lending program ids are accepted, the vault must fall by exactly the amount lent, and the shares sit in an account owned by the offer.
- If lending ever returns less than was put in, the shortfall is shared pro rata and settlement still completes. No path leaves money stuck in the vault.

## Live on devnet

Program: [`BJxkmWB63H6yzkmm3Vrv5a9zGe7FPfPe1uFcur77kTD3`](https://explorer.solana.com/address/BJxkmWB63H6yzkmm3Vrv5a9zGe7FPfPe1uFcur77kTD3?cluster=devnet)

Four books are seeded, and two of them have run their whole life on chain:

| Book | State | What to look at |
| --- | --- | --- |
| [Adire Collective Fund I](https://explorer.solana.com/address/7maQjjNrTgjLw1F1jwstNuvzAwgiXbhQe5rrW6FyJ5N5?cluster=devnet) | Settled. 36,650 units requested for 20,000 on offer | [close](https://explorer.solana.com/tx/e2UqTDPDm8ZpsqwFEpG34mVYqxGaVWLZikgFtvFphCRqQgxfjRPNc76xZGEcQ2C6JZGscyRhv3jartvLSndgj52?cluster=devnet), [five allotments with refunds and receipts in one transaction](https://explorer.solana.com/tx/WfribMYYgrQyJiDqxyborhMXzcpq1NszF1dKVTSbh7HPgiMtZNQ7WNTVusUA1JARBrxwm7WF28wgCDtc7k1n57p?cluster=devnet), [issuer paid](https://explorer.solana.com/tx/1uqMb9N9oTKUvog8HaGcKMguJPVGEz6vs96uRnatWQ19NbWx3rjKktScgQ9ShmsGzVfvBzinZuLRftmqghHFrd8?cluster=devnet) |
| [Mangrove Cold Chain](https://explorer.solana.com/address/B6z1yYxzGZ3CYgKzmbRWbr2dao9X6zUFY4Cadrm36opF?cluster=devnet) | Missed its minimum raise. Everyone refunded in full | [close](https://explorer.solana.com/tx/u74Am5a7PMavPDuQpHTL3szW8XMjdWg7o1s1zQntjsrrstuT3tUVTL7pjJGvUuLHMXgLWYq7HGkTYUGxCD5jti9?cluster=devnet), [three refunds in one transaction](https://explorer.solana.com/tx/yoGhCBP24jZCWTT2sDu5xZu9PyNxMPEdd2SX7F6ZJT2cpvFZbZKEegLa9JeMidZQVDuiF9mnWkoA567fuHV6FxE?cluster=devnet) |
| [Kuramo Terminals Series A](https://explorer.solana.com/address/Ps5qeem98DaVyMGkHwDe2u3q3YJAZzzigHQbcdCJBV4?cluster=devnet) | Open, 2.57 times oversubscribed | Subscribe with test USDC from the faucet |
| [Savannah Grid Notes 2028](https://explorer.solana.com/address/7dLxMornNsr9CfQr7v4FSJm6WfaazxoSpRUcuqcK1hii?cluster=devnet) | Open, below its minimum raise so far | Subscribe with test USDC from the faucet |

Jupiter Lend has no market on devnet, so devnet books hold their money in the vault. The lending path runs in the tests and on the local validator described below, both against the real Jupiter programs.

## Repository

| Path | What it is |
| --- | --- |
| `programs/allot` | The Anchor program and its tests |
| `sdk` | TypeScript client: account decoding, instruction builders, the allotment maths |
| `keeper` | Settlement keeper, demo seed and end to end scripts |
| `app` | Web app: offers, subscribing, portfolio, issuer console, allotment checker |
| `docs/protocol.md` | Protocol specification |
| `scripts` | Local validator with Jupiter Lend loaded, and the snapshot refresher |

## Run it locally

Needs Rust 1.89, Solana CLI 3.1, Anchor 1.2.2, Node 20 and pnpm.

```sh
pnpm install
pnpm build:program
cargo test -p allot
```

To run the whole product on your machine, with Jupiter Lend included:

```sh
solana-keygen new -o keeper/.state/local.json --no-bip39-passphrase
pnpm validator $(solana-keygen pubkey keeper/.state/local.json)
```

In a second terminal:

```sh
export KEYPAIR=$PWD/keeper/.state/local.json RPC_URL=http://127.0.0.1:8899
solana airdrop 100 $(solana-keygen pubkey $KEYPAIR) -u $RPC_URL
MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v pnpm seed
pnpm dev
```

The seed opens four books: one oversubscribed and lending on Jupiter, one quiet, one that has already settled and one that failed its minimum raise and refunded everyone. The app's faucet hands out test USDC and a little SOL for fees.

The program is built with `--arch v0` on purpose. Anchor 1.2 defaults to a newer bytecode version that public clusters do not run yet.

## Build with it

The program is permissionless. A broker, a wallet or a registrar can open offers and let its own users subscribe without touching this app:

```ts
import { getProgram, fetchOffer, subscribeIx, allotment } from 'allot-sdk'

const program = getProgram(connection, wallet)
const offer = await fetchOffer(program, offerKey)
const ix = await subscribeIx(program, offer, wallet.publicKey, 250n)
const wouldReceive = allotment(offer, 250n)
```

## Licence

MIT
