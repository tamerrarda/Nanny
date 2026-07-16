# Nanny — your AI agent needs adult supervision

## Description

Nanny gives your AI agent an allowance instead of your wallet: a vault on Monad
whose spending rules are enforced by a smart contract.

## Problem

People have started handing AI agents jobs that spend real money — groceries,
subscriptions, API credits. There is no safe way to do it.

- **Hand the agent a card or a wallet and the whole balance is exposed.** Its
  authority is all-or-nothing: it can spend everything, anywhere, forever.
- **An LLM agent can be talked into anything.** A poisoned page or a forged
  invoice is enough to change what it decides to do. Prompt injection is not a
  bug someone is about to fix; it is what these models are.
- **Limits written in the app don't survive that.** If the rules live inside the
  same program the attacker just persuaded, they were never rules — they were
  suggestions, and the agent has already been talked out of them.

## Solution

Put the rules somewhere the agent cannot argue with: the chain.

The money stays in the vault. The agent never holds it and can never move it — it
can only *ask* the vault to pay, and the vault decides. Four rules answer that
ask: how much has trickled in so far, how much may pile up, how large one payment
may be, and who may be paid at all. Every spend also has to carry the agent's own
stated reason, written on-chain, so a bad decision leaves a receipt.

The agent is never told any of this. There is nothing in its context to talk it
out of, because the rules were never in its context.

> **You can fool the agent. You can't fool the math.**

That is a demonstration, not a slogan: the app ships two prompt-injection attacks
that genuinely fool the agent, and you watch the contract refuse them — one on the
recipient allowlist, one on the per-transaction cap. See [Try it](#try-it).

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
   It pays, and writes its reason to the chain.
5. Then poison it. Both buttons hand the agent a forged merchant record as
   *external content* — the way a real prompt injection arrives, as data the
   agent reads rather than an instruction you gave it. The agent believes the
   record. The contract does not:

   | Button | What the agent tries | What the chain says |
   |---|---|---|
   | **Fake address change** | Pays the attacker, because the forged order carries its own `payout_address` | `NANNY: recipient not allowed` |
   | **Drain to allowed merchant** | Pays 0.9 MON to a real merchant, because the forged invoice says the full balance is due in one transaction | `NANNY: exceeds per-tx cap` |

   Two different lies, two different rules, neither of them in the agent's head.

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
| `GOOGLE_GENERATIVE_AI_API_KEY` | Free path — a key from [Google AI Studio](https://aistudio.google.com/apikey), no credit card. Calls go straight to Google. |
| `AI_GATEWAY_API_KEY` | Gateway path — Vercel AI Gateway. Also accepts an OIDC token via `vercel link && vercel env pull`. Needs a card on the Vercel team before it serves anything, free credits included. |
| `AGENT_MODEL` | `gemini-3.1-flash-lite` with the Google key; `provider/model` through the gateway |

Set one of the two model keys. The route sends to Google directly when
`GOOGLE_GENERATIVE_AI_API_KEY` is present, and through the gateway otherwise.

**On picking a model.** Do not trust a model id from a blog post — check it
against your own key, because the free tier is narrower than it is documented to
be. On a key made in July 2026, `gemini-2.5-flash` and `gemini-2.0-flash` answer
`no longer available to new users`, and `models.list` cheerfully lists both
anyway. Preview models have a separate trap: `gemini-3-flash-preview` works and
calls tools correctly, then exhausts its free daily quota in roughly twenty
requests. `gemini-3.1-flash-lite` is what this runs on;
`gemini-flash-lite-latest` is the spare.

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
