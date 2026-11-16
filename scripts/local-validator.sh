#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIX="$ROOT/programs/allot/tests/fixtures/jupiter"
AUTHORITY=${1:?usage: local-validator.sh <usdc mint authority pubkey>}
TMP="$(mktemp -d)"

python3 - "$FIX" "$TMP" "$AUTHORITY" <<'EOF'
import base64, json, sys

fix, out, authority = sys.argv[1:4]
ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

def b58(s):
    n = 0
    for c in s:
        n = n * 58 + ALPHABET.index(c)
    return n.to_bytes(32, "big")

for line in open(f"{fix}/manifest.txt"):
    part = line.split()
    if part[0] != "account":
        continue
    key, owner, lamports = part[1], part[2], int(part[3])
    data = bytearray(open(f"{fix}/{key}.bin", "rb").read())
    if key == USDC:
        data[0:4] = (1).to_bytes(4, "little")
        data[4:36] = b58(authority)
    account = {
        "lamports": lamports,
        "data": [base64.b64encode(bytes(data)).decode(), "base64"],
        "owner": owner,
        "executable": False,
        "rentEpoch": 18446744073709551615,
        "space": len(data),
    }
    json.dump({"pubkey": key, "account": account}, open(f"{out}/{key}.json", "w"))
EOF

args=()
for f in "$TMP"/*.json; do
  args+=(--account "$(basename "$f" .json)" "$f")
done
for p in jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9 jupeiUmn818Jg1ekPURTpr4mFo29p46vygyykFJ3wZC; do
  args+=(--bpf-program "$p" "$FIX/$p.so")
done
args+=(--bpf-program 22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG "$ROOT/programs/allot/tests/fixtures/sas/22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG.so")

exec solana-test-validator --reset --quiet \
  --ledger "$ROOT/test-ledger" \
  --bpf-program BJxkmWB63H6yzkmm3Vrv5a9zGe7FPfPe1uFcur77kTD3 "$ROOT/target/deploy/allot.so" \
  "${args[@]}"
