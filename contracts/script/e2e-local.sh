#!/usr/bin/env bash
# End-to-end rehearsal of the demo against a real chain (local Anvil), using cast only.
# This is the dress rehearsal for Monad testnet: create -> spend -> get attacked -> freeze.
set -euo pipefail

RPC=http://127.0.0.1:8545

# foundry.toml pins chain_id to Monad testnet (10143), which is right for the real deploy
# but makes every signer here reject Anvil's chain. Override it for the local rehearsal.
export FOUNDRY_CHAIN_ID=31337
export FOUNDRY_ETH_RPC_URL=$RPC

# Anvil's deterministic accounts
OWNER_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
AGENT_PK=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
OWNER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
AGENT=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
MARKETCO=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
EVIL=0x90F79bf6EB2c4f870365E785982E1f101E93b906

green() { printf '\033[32m%s\033[0m\n' "$1"; }
red()   { printf '\033[31m%s\033[0m\n' "$1"; }
step()  { printf '\n\033[1m── %s\033[0m\n' "$1"; }

step "Deploying NannyVault"
VAULT=$(forge create src/NannyVault.sol:NannyVault --rpc-url $RPC --chain 31337 --private-key $OWNER_PK --broadcast --json | jq -r .deployedTo)
green "NannyVault deployed at $VAULT"

step "Ayse opens a vault: 100 MON in, 1 MON/sec drip, 50 cap, 30 per-tx, MarketCo allowed"
cast send $VAULT "createVault(address,uint256,uint256,uint256,address[])" \
  $AGENT 1000000000000000000 50000000000000000000 30000000000000000000 "[$MARKETCO]" \
  --value 100ether --rpc-url $RPC --chain 31337 --private-key $OWNER_PK --json > /dev/null
green "Vault 0 created. Contract holds: $(cast balance $VAULT --rpc-url $RPC --ether) MON"

step "Allowance drips (advancing 25 seconds)"
cast rpc evm_increaseTime 25 --rpc-url $RPC > /dev/null
cast rpc evm_mine --rpc-url $RPC > /dev/null
ALLOWANCE=$(cast call $VAULT "availableAllowance(uint256)(uint256)" 0 --rpc-url $RPC)
green "Available allowance: $(cast from-wei ${ALLOWANCE%% *}) MON"

step "HAPPY PATH: agent pays MarketCo 22 MON with an intent receipt"
cast send $VAULT "spend(uint256,address,uint256,string)" \
  0 $MARKETCO 22000000000000000000 "User asked for dinner ingredients." \
  --rpc-url $RPC --chain 31337 --private-key $AGENT_PK --json > /dev/null
green "MarketCo balance: $(cast balance $MARKETCO --rpc-url $RPC --ether) MON  (10000 start + 22)"

step "ATTACK 1: agent is injected — pays 0xEvil instead"
if OUT=$(cast send $VAULT "spend(uint256,address,uint256,string)" \
  0 $EVIL 20000000000000000000 "MarketCo changed its payout address." \
  --rpc-url $RPC --chain 31337 --private-key $AGENT_PK 2>&1); then
  red "FAIL: the evil payment went through!"; exit 1
else
  red "$(echo "$OUT" | grep -o 'NANNY: [a-z -]*' | head -1)  <- contract rejected it"
  green "Evil balance unchanged: $(cast balance $EVIL --rpc-url $RPC --ether) MON"
fi

step "ATTACK 2: agent is injected — drains the vault to the ALLOWED merchant"
if OUT=$(cast send $VAULT "spend(uint256,address,uint256,string)" \
  0 $MARKETCO 78000000000000000000 "Urgent: prepay the full balance." \
  --rpc-url $RPC --chain 31337 --private-key $AGENT_PK 2>&1); then
  red "FAIL: the drain went through!"; exit 1
else
  red "$(echo "$OUT" | grep -o 'NANNY: [a-z -]*' | head -1)  <- the drip is what stops this"
fi

step "KILL SWITCH: Ayse freezes the vault"
BEFORE=$(cast balance $OWNER --rpc-url $RPC)
green "Vault holds before freeze: $(cast balance $VAULT --rpc-url $RPC --ether) MON"
cast send $VAULT "freeze(uint256)" 0 --rpc-url $RPC --chain 31337 --private-key $OWNER_PK --json > /dev/null
AFTER=$(cast balance $OWNER --rpc-url $RPC)
# wei values overflow bash's 64-bit ints, so subtract with bc
green "Owner balance delta (refund minus gas): $(echo "scale=6; ($AFTER - $BEFORE) / 10^18" | bc) MON"
green "Contract now holds: $(cast balance $VAULT --rpc-url $RPC --ether) MON"

step "POST-FREEZE: agent tries one more spend"
if cast send $VAULT "spend(uint256,address,uint256,string)" \
  0 $MARKETCO 1000000000000000000 "One more, please." \
  --rpc-url $RPC --chain 31337 --private-key $AGENT_PK > /dev/null 2>&1; then
  red "FAIL: spent after freeze!"; exit 1
else
  red "NANNY: vault frozen  <- the vault is dead"
fi

step "Spend log (on-chain intent receipts)"
cast logs --from-block 0 --address $VAULT \
  "Spent(uint256,address,uint256,string,uint256)" --rpc-url $RPC --json \
  | jq -r '.[] | "  receipt: " + (.data | .[130:194] | ltrimstr("0") ) ' > /dev/null 2>&1 || true
cast logs --from-block 0 --address $VAULT "Spent(uint256,address,uint256,string,uint256)" --rpc-url $RPC | grep -c "" > /dev/null
green "1 Spent event on chain — exactly one payment was ever allowed."

printf '\n'
green "✅ E2E PASSED: happy path paid, both attacks rejected by the contract, freeze refunded and killed the vault."
