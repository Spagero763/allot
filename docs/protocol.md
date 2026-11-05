# Allot protocol

Allot is a primary-market engine on Solana. An issuer opens a book for a fixed number of units at a fixed price. Subscribers commit a stablecoin from their own wallet. While the book is open the committed money can sit in a lending strategy and earn. When the book closes, the program computes every allotment from the on-chain totals, refunds the unallotted balance plus each subscriber's share of the yield, mints allotment receipts, and pays the issuer. No step depends on a human deciding who gets what.

## Accounts

**Config** `["config"]`
Protocol admin, fee in basis points, fee destination, pause flag.

**Offer** `["offer", issuer, offer_id]`
Issuer, settlement mint, unit price, total units, per-subscriber minimum and maximum, guaranteed floor per subscriber, minimum raise, open and close timestamps, status, running totals (units requested, principal, floor demand, time weight, subscriber count), results (yield total, units allotted, subscriptions processed), issuer treasury, receipt mint, strategy, fee snapshot.

**Subscription** `["sub", offer, subscriber]`
Subscriber, units requested, amount paid, commit timestamp, time weight, allotted units, refund, yield share, settled flag.

**Vault**
Associated token account of the offer for the settlement mint. Only the program moves money out of it.

**Receipt mint**
Token-2022 mint with zero decimals and on-chain metadata. One token is one allotted unit. The offer is the mint authority.

## Lifecycle

1. `create_offer` (issuer). Creates the offer, the vault and the receipt mint. Terms are immutable after this.
2. `subscribe` (subscriber). Allowed between open and close. Transfers `units * unit_price` into the vault and records the commit time. One subscription per wallet per offer.
3. `cancel_subscription` (subscriber). Allowed while the book is open. Returns the principal.
4. `sweep` and `unsweep` (anyone). Move idle vault balance into the strategy and back. Only valid when the offer has a strategy.
5. `close_offer` (anyone, after close). Requires the strategy position to be empty. Marks the offer closed, records whether the minimum raise was met, and records the yield as vault balance minus principal.
6. `allot` (anyone, per subscription). Computes the allotment, refunds, pays the yield share, mints receipts, marks the subscription settled.
7. `settle_issuer` (anyone, after every subscription is processed). Pays the protocol fee and sends the proceeds to the issuer treasury.
8. `cancel_offer` (issuer, while open). The offer is treated as failed: every subscription is refunded in full with its yield share.

## Allotment

Let `U` be total units, `R` total units requested, `f` the floor per subscriber, `r_i` a subscriber's request.

- If `R <= U`, everyone receives `r_i`.
- Otherwise each subscriber first receives `g_i = min(r_i, f)`. Let `G` be the sum of all `g_i`, tracked at subscribe time. If `G > U` the floor cannot be honoured and the offer falls back to pure pro rata: `a_i = floor(r_i * U / R)`.
- With the floor honoured, the remaining supply `U - G` is split pro rata over the remaining demand `R - G`: `a_i = g_i + floor((r_i - g_i) * (U - G) / (R - G))`.

Division rounds down, so a few units may stay unallotted. They stay with the issuer. Every input to the formula is on the offer account, so anyone can recompute any subscriber's allotment.

## Yield

Each subscription carries a weight `amount * (close_ts - commit_ts)`. At close the yield is the vault balance above the principal. A subscriber's share is `yield * weight / total_weight`. Money that has been in the book longer earns more, which is the only fair split when commits arrive at different times.

The strategy is per offer. `Idle` keeps the vault as is. `JupiterLend` deposits into Jupiter Lend Earn for the settlement mint and withdraws before close. Offers in tokens with no lending market use `Idle`.

## Fees

The protocol fee is a share of the issuer's proceeds, taken at settlement. Subscribers never pay it. Refunds and yield are paid in full.

## Invariants

- Vault balance after settlement is zero.
- Receipt supply equals units allotted.
- Sum of allotted units never exceeds total units.
- A subscription is settled exactly once.
- No instruction after close changes the terms, the totals or the weights.
