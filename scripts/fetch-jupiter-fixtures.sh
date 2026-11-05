#!/usr/bin/env bash
set -euo pipefail

RPC=${RPC:-https://api.mainnet-beta.solana.com}
OUT="$(cd "$(dirname "$0")/.." && pwd)/programs/allot/tests/fixtures/jupiter"
mkdir -p "$OUT"

programs=(
  jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9
  jupeiUmn818Jg1ekPURTpr4mFo29p46vygyykFJ3wZC
)
accounts=(
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
  9BEcn9aPEmhSPbPQeFGjidRiEKki46fVQDyPpSQXPA2D
  5nmGjA4s7ATzpBQXC5RNceRpaJ7pYw2wKsNBWyuSAZV6
  2vVYHYM8VYnvZqQWpTJSj8o8DBf1wM8pVs3bsTgYZiqJ
  94vK29npVbyRHXH63rRcTiSr26SFhrQTzbpNJuhQEDu
  Hf9gtkM4dpVBahVSzEXSVCAPpKzBsBcns3s8As3z77oF
  5pjzT5dFTsXcwixoab1QDLvZQvpYJxJeBphkyfHGn688
  BmkUoKMFYBxNSzWXyUjyMJjMAaVz4d8ZnxwwmhDCUXFB
  HN1r4VfkDn53xQQfeGDYrNuDKFdemAhZsHYRwBrFhsW
  7s1da8DduuBFqGra5bJBjpnvL5E9mGzCuMk1Qkh4or2Z
  5xSPBiD3TibamAnwHDhZABdB4z4F9dcj5PnbteroBTTd
)

for p in "${programs[@]}"; do
  solana program dump -u "$RPC" "$p" "$OUT/$p.so" >/dev/null
  sleep 2
done

: > "$OUT/manifest.txt"

for a in "${accounts[@]}"; do
  info=$(solana account -u "$RPC" "$a" -o "$OUT/$a.bin" 2>&1 || true)
  if echo "$info" | grep -q "Owner:"; then
    owner=$(echo "$info" | awk "/^Owner:/ {print \$2}")
    lamports=$(solana balance -u "$RPC" --lamports "$a" | awk "{print \$1}")
    echo "account $a $owner $lamports" >> "$OUT/manifest.txt"
  else
    echo "missing $a" >> "$OUT/manifest.txt"
  fi
  sleep 2
done

sleep 20
bt=$(solana block-time -u "$RPC")
slot=$(echo "$bt" | awk "/^Block:/ {print \$2}")
time=$(date -d "$(echo "$bt" | awk "/^Date:/ {print \$2}")" +%s)
echo "clock $slot $time" >> "$OUT/manifest.txt"
cat "$OUT/manifest.txt"
