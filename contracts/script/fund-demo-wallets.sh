#!/usr/bin/env bash
# Funds the demo owner + agent wallets from the deployer keystore.
# The deployer already holds ~10 testnet MON. Run once:
#   ! bash contracts/script/fund-demo-wallets.sh
set -euo pipefail

RPC=https://testnet-rpc.monad.xyz
OWNER=0x93F7d4dAAcbd68cA21f1B3aE9D21BBB002054736   # creates/freezes vaults + deposits
AGENT=0x46b471F32D1C2B537d63635954F41320e2D1Cd29   # pays gas for spends

echo "Sending 6 MON to owner ($OWNER)…"
cast send "$OWNER" --value 6ether --rpc-url "$RPC" --account nanny-deployer

echo "Sending 2 MON to agent ($AGENT)…"
cast send "$AGENT" --value 2ether --rpc-url "$RPC" --account nanny-deployer

echo ""
echo "owner balance: $(cast balance "$OWNER" --rpc-url "$RPC" --ether) MON"
echo "agent balance: $(cast balance "$AGENT" --rpc-url "$RPC" --ether) MON"
