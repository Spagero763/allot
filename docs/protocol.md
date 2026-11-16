# Allot protocol

Allot is a primary-market engine on Solana. An issuer opens a book for a fixed number of units at a fixed price. Subscribers commit a stablecoin from their own wallet. While the book is open the committed money can sit in a lending strategy and earn. When the book closes, the program computes every allotment from the on-chain totals, refunds the unallotted balance plus each subscriber's share of the yield, mints allotment receipts, and pays the issuer. No step depends on a human deciding who gets what.

## Accounts

**Config** `["config"]`
Protocol admin, fee in basis points, fee destination, pause flag.

**Offer** `["offer", issuer, offer_id]`
Issuer, settlement mint, unit price, total units, per-subscriber minimum and maximum, guaranteed floor per subscriber, minimum raise, open and close timestamps, an optional attestation schema that gates subscriptions, status, running totals (units requested, principal, floor demand, time weight, subscriber count), amount in the strategy, results (yield total, loss, units allotted, subscriptions processed), issuer treasury, receipt mint, strategy, fee snapshot.

**Subscription** `["sub", offer, subscriber]`
Subscriber, units requested, amount paid, commit timestamp, time weight, allotted units, refund, yield share, settled flag.

**Vault**
Associated token account of the offer for the settlement mint. Only the program moves money out of it.

**Receipt mint**
Token-2022 mint with zero decimals and on-chain metadata. One token is one allotted unit. The offer is the mint authority.

## Lifecycle

1. `create_offer` (issuer). Creates the offer, the vault and the receipt mint. Terms are immutable after this.
2. `subscribe` (subscriber). Allowed between open and close. Transfers `units * unit_price` into the vault and records the commit time. One subscription per wallet per offer. If the offer names a gate schema, the subscriber passes their attestation account and the program checks it (see Eligibility).
3. `cancel_subscription` (subscriber). Allowed while the book is open. Returns the principal.
4. `sweep` (issuer or protocol admin, while open). Lends idle vault balance through the strategy. At least 10% of the principal must stay in the vault so subscribers can leave without waiting.
5. `unsweep` (issuer, admin, any subscriber of the offer, or anyone once the close time has passed). Redeems the whole position back into the vault.
6. `close_offer` (anyone, after close). Requires the strategy position to be empty. Marks the offer closed, records whether the minimum raise was met, and records the yield as vault balance minus principal, or the loss if the vault holds less than the principal.
7. `allot` (anyone, per subscription). Computes the allotment, refunds, pays the yield share, mints receipts, marks the subscription settled.
8. `finalize` (anyone, after every subscription is processed). Pays the protocol fee and sends the proceeds to the issuer treasury.
9. `cancel_offer` (issuer, while open). Requires the strategy position to be empty. The offer is treated as failed: every subscription is refunded in full with its yield share.

## Allotment

Let `U` be total units, `R` total units requested, `f` the floor per subscriber, `r_i` a subscriber's request.

- If `R <= U`, everyone receives `r_i`.
- Otherwise each subscriber first receives `g_i = min(r_i, f)`. Let `G` be the sum of all `g_i`, tracked at subscribe time. If `G > U` the floor cannot be honoured and the offer falls back to pure pro rata: `a_i = floor(r_i * U / R)`.
- With the floor honoured, the remaining supply `U - G` is split pro rata over the remaining demand `R - G`: `a_i = g_i + floor((r_i - g_i) * (U - G) / (R - G))`.

Division rounds down, so a few units may stay unallotted. They stay with the issuer. Every input to the formula is on the offer account, so anyone can recompute any subscriber's allotment.

## Yield

Each subscription carries a weight `amount * (close_ts - commit_ts)`. At close the yield is the vault balance above the principal. A subscriber's share is `yield * weight / total_weight`. Money that has been in the book longer earns more, which is the only fair split when commits arrive at different times.

The strategy is per offer. `Idle` keeps the vault as is. `JupiterLend` deposits into Jupiter Lend Earn for the settlement mint and redeems before close. Offers in tokens with no lending market use `Idle`.

The program calls Jupiter Lend directly. It only accepts the known lending program ids, checks that the vault fell by exactly the amount swept and that shares arrived, and on the way back requires the share balance to reach zero. The shares sit in a token account owned by the offer, so nobody else can redeem them.

## Loss

Lending carries risk. If the vault holds less than the principal at close, the difference is recorded as `loss` and no yield is paid. Each subscriber's refund is reduced by `ceil(loss * amount / principal)`, never below zero, and the issuer absorbs whatever a fully allotted subscriber has no refund left to cover. Settlement always completes: no shortfall can leave money stuck in the vault.

## Proof

`programs/allot/tests/strategy.rs` runs the whole path against the real Jupiter Lend and liquidity programs and a snapshot of their mainnet accounts for USDC, loaded into the test VM. `scripts/fetch-jupiter-fixtures.sh` refreshes the snapshot. `scripts/local-validator.sh` boots a local validator with the same state so the app and the keeper can be run against it.

## Eligibility

An offer may carry a `gate`: the address of a schema account in the Solana Attestation Service. When it is set, `subscribe` requires an attestation account and checks, without a CPI, that the account is owned by the attestation program, carries the attestation discriminator, names that schema, was issued for the subscriber (the attestation nonce equals the subscriber's key), has not expired, and sits at the canonical address `["attestation", credential, schema, subscriber]`. Anything else fails with `NotEligible`.

Who issues attestations is the issuer's choice, made by choosing the schema. The program does not care whether that is a KYC provider, a registrar or the issuer itself. A closed attestation has no account, so revocation needs no extra handling.

## Fees

The protocol fee is a share of the issuer's proceeds, taken at settlement. Subscribers never pay it. Refunds and yield are paid in full.

## Invariants

- Vault balance after settlement is zero.
- Receipt supply equals units allotted.
- Sum of allotted units never exceeds total units.
- A subscription is settled exactly once.
- No instruction after close changes the terms, the totals or the weights.
- An offer cannot close or be cancelled while money is still in the strategy.
- Refunds, yield, fee and proceeds together never exceed what the vault holds.
