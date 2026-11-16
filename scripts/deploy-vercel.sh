#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/app"

vercel link --yes --project allot

set -a
. ./.env.production.local
set +a
for key in VITE_CLUSTER VITE_RPC_URL VITE_MINT VITE_MINT_DECIMALS VITE_MINT_SYMBOL VITE_MINTS VITE_KYC_SCHEMA FAUCET_MINTS; do
  printf '%s' "${!key}" | vercel env add "$key" production --force >/dev/null
done
printf '%s' "$VITE_RPC_URL" | vercel env add RPC_URL production --force >/dev/null
vercel env add FAUCET_KEY production --sensitive --force < "$ROOT/keeper/.state/faucet-devnet.json" >/dev/null

vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
