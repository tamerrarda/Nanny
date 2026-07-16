# Nanny — your AI agent needs adult supervision

Give an AI agent an allowance, not your wallet. Nanny is a vault on Monad whose
rules are enforced by a smart contract, so they hold even when the agent itself
is talked into breaking them.

> **You can fool the agent. You can't fool the math.**

The agent never holds the money. It can only ask the vault to pay, and the vault
decides. An agent that gets prompt-injected still can't send funds somewhere you
never allowed, or spend more than has trickled in so far.

**Live contract:** [`0x8399F8AfD80646d8e6c8Bc74B2C161C64B70228b`](https://testnet.monadscan.com/address/0x8399F8AfD80646d8e6c8Bc74B2C161C64B70228b)
on Monad testnet (chain `10143`).

---

## How it works

Four rules live in the contract, not in the agent's prompt — the agent is never
even told what they are:

| Rule | What it does |
|---|---|
| **Streaming allowance** | Funds trickle in per second. A fooled agent can only ever spend what has accrued so far, not the balance. |
| **Accrual cap** | Unspent allowance stops growing, so leaving the vault alone doesn't build a jackpot. |
| **Per-transaction cap** | A ceiling on any single payment. |
| **Recipient allowlist** | The agent can only pay addresses you approved. Anywhere else reverts on-chain. |

Every spend must also carry an **intent note** — the agent has to write down why
it spent, permanently, on-chain. It can lie, but the lie is now evidence.

The only way out is **freeze**: one action returns the whole remaining balance to
the owner and closes the vault.

## Try it

1. Connect a wallet (MetaMask or any injected wallet) and switch to Monad testnet.
2. Get testnet MON from the [faucet](https://faucet.monad.xyz).
3. Open a vault: set the allowance, the caps, which merchants are allowed, and
   the deposit. You sign this — the vault is yours on-chain.
4. Tell the agent to buy something: _"Order 0.3 MON of groceries from MarketCo."_
5. Then poison it. The **Fake address change** button feeds the agent a forged
   "our payout address has changed" notice as *external content*, the way a real
   prompt injection arrives. The agent believes it and tries to pay the attacker.
   The contract rejects the transaction.

## Running locally

Requires Node 20+ and [Foundry](https://book.getfoundry.sh) for the contracts.

```bash
# contracts
cd contracts
forge test                     # unit + fuzz + invariant suites

# web
cd web
npm install
npm run dev                    # http://localhost:3000
```

### Environment

Copy `.env.example` to `web/.env.local` and fill it in.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_NANNY_VAULT_ADDRESS` | Deployed NannyVault address |
| `NEXT_PUBLIC_MONAD_RPC_URL` | Monad RPC (defaults to the public testnet RPC) |
| `NEXT_PUBLIC_CHAIN_ID` | `10143` for Monad testnet |
| `AGENT_PRIVATE_KEY` | The demo agent's key. It signs spends autonomously — that is the product, not a shortcut. Server-side only. |
| `NEXT_PUBLIC_AGENT_ADDRESS` | Public address of `AGENT_PRIVATE_KEY` |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key for the LLM |
| `AGENT_MODEL` | e.g. `google/gemini-3-flash` |

There is deliberately **no owner key**. Owners connect their own wallet and sign
`createVault` / `deposit` / `freeze` themselves, so each vault's on-chain owner is
the person who opened it.

### Deploying the contract

Use a Foundry keystore. Never put a raw private key on the command line.

```bash
cast wallet import nanny-deployer --interactive
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://testnet-rpc.monad.xyz \
  --account nanny-deployer \
  --broadcast
```

---

## Deliberately out of scope

Nanny demonstrates one idea, executed honestly rather than a product pretending
to be finished. These are known gaps, not oversights:

1. **One shared demo agent — phase 2.** The product is meant to supervise _your_
   agent. Today every vault opened here authorizes the same hosted agent, because
   a web page cannot host each visitor's autonomous signer. **The contract already
   takes a per-vault agent** — `createVault(address agent, …)` stores it and
   `spend` checks `msg.sender == v.agent` — so bringing your own agent is a UI
   change, not a contract change. Until then, `/api/agent` requires a signature
   from the vault's owner, so only you can direct the agent on your vault.
2. **No fiat / TRY rails.** Testnet MON only. Production needs a stablecoin and
   an on/off-ramp.
3. **No category rules** (e.g. "groceries only"). A category is represented by an
   allowlisted address. Real category detection is an oracle/attestation problem.
4. **Intent notes aren't verifiable on-chain.** The agent can write anything. The
   value is that the claim is permanent and auditable, not that it is true.
5. **Freeze is one-way and the only exit.** There is no partial `withdraw`: to get
   your money back you freeze the vault, which closes it. A frozen vault never
   reopens — you open a new one. This is a deliberate simplification; an
   emergency brake should be one unambiguous action. `withdraw(vaultId, amount)`
   is a v2 item.
6. **Key management is demo-grade.** Production wants session keys or account
   abstraction (ERC-4337) for the agent, not a long-lived hot key.
7. **Native MON only.** ERC-20 support is v2.
8. **The agent wallet pays gas for everyone.** It needs topping up, and when it
   runs dry no vault can spend.

## Where Nanny sits

| Project | What it does | How Nanny differs |
|---|---|---|
| MetaMask Agent Wallet | CLI-based safety layer for DeFi trader agents | Nanny is consumer-facing: set up in two minutes without knowing crypto |
| Coinbase Agentic Wallets / Crossmint | SDKs and infrastructure for developers | Nanny is a finished product, not an SDK |
| Safe allowance module | A developer module on Ethereum | Nanny is Monad-native and adds the intent-receipt layer |

The piece nobody else has: the **intent receipt** — the "why" behind every spend,
on-chain, readable like a bank statement.

## Stack

Next.js 16 · React 19 · Tailwind v4 · wagmi/viem · Vercel AI SDK ·
Solidity 0.8.28 (Foundry) · Monad testnet
