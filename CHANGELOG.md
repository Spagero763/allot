# Build log

What was built, and when. Newest first.

## 17 November
- Site live on devnet at allot-navy.vercel.app, with the faucet and the demo verifier running as serverless functions.
- Android release for Solana Mobile: signed web shell that connects through Mobile Wallet Adapter.
- Privacy and terms pages. Scheduled keeper settling closed books.

## 16 November
- Books gated by the Solana Attestation Service: the program refuses commits from wallets without a valid attestation under the schema the issuer names.
- Books in any stablecoin, with a naira book in the demo.
- Property tests over random books and a randomized end to end conservation test.
- Program upgraded on devnet and reseeded with six books.

## 9 November
- Mobile Wallet Adapter on Android, installable web app.
- Issuer console replays the typed terms as an animated book.

## 6 to 7 November
- First devnet deployment, seeded books and proof transactions.
- Confirmation by polling, time read from the chain, lighter refetching.
- Settlement from the app: recall lent funds, close, allot and pay the issuer.

## 5 November
- The program: offers, subscriptions, on-chain allotment with a floor, refunds, receipts as Token-2022 mints, permissionless settlement.
- Lending idle book money on Jupiter Lend with a reserve, tested against the real programs on forked state, with pro rata handling of any shortfall.
- TypeScript SDK, keeper, seed and end to end scripts.
- Web app: offers, subscribing, portfolio, issuer console, allotment checker.
