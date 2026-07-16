<div align="center">

# Nanny

### Your AI agent needs adult supervision.

**[Live demo →](https://getnanny.vercel.app)**  ·  **[Demo video →](https://youtu.be/yDEuN9lzFTY)**  ·  [Contract on Monad](https://testnet.monadscan.com/address/0x8399F8AfD80646d8e6c8Bc74B2C161C64B70228b)

</div>

![Nanny](docs/hero.png)

---

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

> ### You can fool the agent. You can't fool the math.

---

## The part worth seeing

The app ships two real prompt injections. They are not staged: the agent is a
real LLM, it genuinely falls for them, and it genuinely tries to pay. Then the
contract refuses.

![The agent is fooled. The contract refuses.](docs/blocked.png)

Read that screenshot closely. The agent was handed a forged MarketCo order
carrying its own `payout_address`, believed it, and called `spend` toward an
address you never approved. The vault reverted with **`NANNY: recipient not
allowed`** — and the money never moved.

| Attack | What the agent tries | What the chain says |
|---|---|---|
| **Fake address change** | Pays an attacker, because the forged order carries its own payout address | `NANNY: recipient not allowed` |
| **Drain to allowed merchant** | Pays 0.9 MON to a *real* merchant, because the forged invoice says the full balance is due in one transaction | `NANNY: exceeds per-tx cap` |

Two different lies. Two different rules. Neither of them in the agent's head.

---

## How it works

Four rules live in the contract, not in the agent's prompt:

| Rule | What it does |
|---|---|
| **Streaming allowance** | Funds trickle in per second. A fooled agent can only ever spend what has accrued so far, not the balance. |
| **Accrual cap** | Unspent allowance stops growing, so leaving the vault alone doesn't build a jackpot. |
| **Per-transaction cap** | A ceiling on any single payment. |
| **Recipient allowlist** | The agent can only pay addresses you approved. Anywhere else reverts on-chain. |

You set them once, and you sign it — the vault is yours on-chain, not ours.

![Open a vault](docs/open-a-vault.png)

Every spend carries an **intent note**: the agent must write down *why* it spent,
permanently, on-chain. It can lie, but the lie is now evidence you can read back
like a bank statement.

![Activity](docs/activity.png)

The only way out is **freeze**: one action returns the whole remaining balance to
you and closes the vault.

---

## Try it

Nothing to install — it is live at **[getnanny.vercel.app](https://getnanny.vercel.app)**.

1. Connect a wallet and switch to Monad testnet.
2. Get testnet MON from the [faucet](https://faucet.monad.xyz).
3. Open a vault: allowance, caps, allowed merchants, deposit. You sign it.
4. Tell the agent to buy something — _"Order 0.3 MON of groceries from MarketCo."_
5. Then poison it. Hit **Fake address change**, and watch the contract refuse.

You pay the deposit and the gas. The vault is yours; Nanny never holds your keys.

---

## Stack

Solidity 0.8.28 (Foundry) on Monad testnet · Next.js 16 · React 19 · Tailwind v4 ·
wagmi/viem · Vercel AI SDK · a WebGL shader and a low-poly owl, both drawn in code

## Where Nanny sits

| Project | What it does | How Nanny differs |
|---|---|---|
| MetaMask Agent Wallet | CLI-based safety layer for DeFi trader agents | Nanny is consumer-facing: set up in two minutes without knowing crypto |
| Coinbase Agentic Wallets / Crossmint | SDKs and infrastructure for developers | Nanny is a finished product, not an SDK |
| Safe allowance module | A developer module on Ethereum | Nanny is Monad-native and adds the intent-receipt layer |

The piece nobody else has: the **intent receipt** — the "why" behind every spend,
on-chain, readable like a bank statement.

## Known gaps

Nanny demonstrates one idea, executed honestly rather than a product pretending
to be finished. The big one: **it hosts a single shared demo agent**, because a
web page cannot host each visitor's autonomous signer. The contract already takes
a per-vault agent, so bringing your own is a UI change rather than a contract
change. That and seven other deliberate limits are written down in
[`web/README.md`](web/README.md#deliberately-out-of-scope).

---

## Quick start

Requires Node 20+ and [Foundry](https://book.getfoundry.sh).

```bash
git clone https://github.com/tamerrarda/Nanny.git
cd Nanny

# contracts — unit, fuzz and invariant suites
cd contracts && forge test

# web
cd ../web
npm install
cp ../.env.example .env.local     # then fill it in, see below
npm run dev                       # http://localhost:3000
```

You need three things in `web/.env.local`:

| Variable | Where it comes from |
|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) — free, no credit card |
| `AGENT_MODEL` | `gemini-3.1-flash-lite` |
| `AGENT_PRIVATE_KEY` | Any funded testnet key. This is the agent's own wallet — it signs spends autonomously, which is the product, not a shortcut. |

The `NEXT_PUBLIC_*` values in `.env.example` already point at the deployed
contract, so you can leave them alone.

There is deliberately **no owner key**: owners connect their own wallet and sign
`createVault` / `deposit` / `freeze` themselves, so each vault's on-chain owner is
the person who opened it.

Deeper notes — the full env table, picking a model that actually works on the free
tier, and deploying the contract — are in [`web/README.md`](web/README.md).
