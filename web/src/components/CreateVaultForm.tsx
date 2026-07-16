"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useState } from "react";
import type { Address } from "viem";
import { useConnect } from "wagmi";
import { AGENT_ADDRESS, MERCHANTS, type Merchant } from "@/lib/contract";
import { hourlyMonToDripRate, monToWei } from "@/lib/units";
import { useNannyWrite } from "@/lib/useNanny";

type Props = {
  onCreated: (vaultId: bigint) => void;
};

const MERCHANT_ICONS: Record<Merchant["icon"], string> = {
  cart: "M7 18a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm10 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM2 2h3.3l.9 4H21a1 1 0 0 1 .97 1.24l-1.9 7.6A2 2 0 0 1 18.13 16H7.6a2 2 0 0 1-1.96-1.6L3.7 4H2V2Zm4.62 6 1 5h10.5l1.25-5H6.62Z",
  book: "M4 3h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm16 0a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-8a2 2 0 0 0-2 2V6a3 3 0 0 1 3-3h7Z",
  code: "m8.7 7.3 1.4 1.4L6.83 12l3.27 3.3-1.4 1.4L4 12l4.7-4.7Zm6.6 0L20 12l-4.7 4.7-1.4-1.4L17.17 12 13.9 8.7l1.4-1.4Z",
};

const field =
  "hud hud-sm w-full bg-canvas-2/80 px-4 py-2.5 font-display text-lg font-bold text-ink outline-none ring-1 ring-inset ring-white/10 transition-all duration-200 placeholder:text-ink-dim focus:bg-canvas-2 focus:ring-2 focus:ring-brand/70";
const label =
  "font-display text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft";
const hint = "mt-1 text-[11px] text-ink-dim";

/* The form is a long column of rules. Landing them one after another gives the
   eye an order to read in; landing all twelve at once is just a wall. */
const formStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.12 } },
};
const row: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  },
};

export function CreateVaultForm({ onCreated }: Props) {
  const { createVault, isPending, error, isConnected } = useNannyWrite();
  // The primary button connects when there's no wallet yet, rather than sitting
  // disabled and sending you hunting for a button somewhere else on the page.
  const { connect, connectors, isPending: connecting, error: connectError } =
    useConnect();
  const busy = isPending || connecting;

  const [daily, setDaily] = useState("60");
  const [maxAccrual, setMaxAccrual] = useState("1");
  const [perTx, setPerTx] = useState("0.5");
  const [deposit, setDeposit] = useState("1");
  const [chosen, setChosen] = useState<Address[]>(
    MERCHANTS.map((m) => m.address),
  );
  const [formError, setFormError] = useState<string | null>(null);

  function toggle(addr: Address) {
    setChosen((prev) =>
      prev.includes(addr) ? prev.filter((a) => a !== addr) : [...prev, addr],
    );
  }

  async function submit() {
    setFormError(null);
    if (chosen.length === 0) {
      setFormError("Pick at least one place your agent can spend.");
      return;
    }
    if (Number(perTx) > Number(maxAccrual)) {
      setFormError("A single spend can't be larger than the max saved-up amount.");
      return;
    }
    try {
      const res = await createVault({
        agent: AGENT_ADDRESS,
        dripRate: hourlyMonToDripRate(daily),
        accrualCap: monToWei(maxAccrual),
        perTxCap: monToWei(perTx),
        recipients: chosen,
        deposit: monToWei(deposit),
      });
      onCreated(BigInt(res.vaultId));
    } catch {
      /* surfaced via `error` below */
    }
  }

  return (
    <motion.div
      variants={formStagger}
      initial="hidden"
      // whileInView, not animate: this form mounts with the page, so `animate`
      // would run the whole stagger while the visitor is still reading the hero
      // and leave nothing to see by the time they scroll down to it.
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className="space-y-3.5"
    >
      <motion.div variants={row}>
        <label className={label}>How much allowance per hour?</label>
        <div className="relative mt-1">
          <input
            className={`${field} pr-20`}
            value={daily}
            onChange={(e) => setDaily(e.target.value)}
            inputMode="decimal"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-display text-sm font-bold uppercase tracking-wider text-brand-text">
            MON
          </span>
        </div>
        <p className={hint}>Trickles in second by second — not all at once.</p>
      </motion.div>

      <motion.div variants={row} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Most it can save up</label>
          <input
            className={`${field} mt-1`}
            value={maxAccrual}
            onChange={(e) => setMaxAccrual(e.target.value)}
            inputMode="decimal"
          />
          <p className={hint}>Unspent allowance stops growing here.</p>
        </div>
        <div>
          <label className={label}>Most it can spend at once</label>
          <input
            className={`${field} mt-1`}
            value={perTx}
            onChange={(e) => setPerTx(e.target.value)}
            inputMode="decimal"
          />
          <p className={hint}>A ceiling on any single payment.</p>
        </div>
      </motion.div>

      <motion.div variants={row}>
        <label className={label}>Where can it spend?</label>
        <div className="mt-1.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {MERCHANTS.map((m) => {
            const on = chosen.includes(m.address);
            return (
              <motion.button
                key={m.address}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggle(m.address)}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className={`hud hud-sm group relative cursor-pointer px-3.5 py-2.5 text-left transition-colors duration-200 ${
                  on
                    ? "bg-brand/18 ring-1 ring-inset ring-brand/60"
                    : "bg-canvas-2/60 ring-1 ring-inset ring-white/5 hover:bg-canvas-2"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`hud hud-sm flex h-8 w-8 shrink-0 items-center justify-center transition-colors duration-200 ${
                      on
                        ? "bg-brand/30 text-brand-text"
                        : "bg-white/5 text-ink-dim"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                      className="h-4 w-4"
                    >
                      <path d={MERCHANT_ICONS[m.icon]} />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <div className="font-display text-sm font-bold uppercase tracking-wide text-ink">
                      {m.name}
                    </div>
                    <div className="truncate text-[11px] text-ink-dim">
                      {m.blurb}
                    </div>
                  </div>
                </div>
                <div
                  className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors duration-200 ${
                    on ? "text-ok" : "text-ink-dim"
                  }`}
                >
                  {on ? (
                    <>
                      <motion.svg
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                        className="h-3 w-3"
                      >
                        <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" />
                      </motion.svg>
                      Allowed
                    </>
                  ) : (
                    "Blocked"
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
        <p className={hint}>
          Your agent can pay only these. Anywhere else is blocked on-chain.
        </p>
      </motion.div>

      <motion.div variants={row}>
        <label className={label}>How much to put in the vault?</label>
        <div className="relative mt-1">
          <input
            className={`${field} pr-20`}
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            inputMode="decimal"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-display text-sm font-bold uppercase tracking-wider text-brand-text">
            MON
          </span>
        </div>
        <p className={hint}>Stays in the vault. Your agent never holds it.</p>
      </motion.div>

      <AnimatePresence>
        {(formError || error || connectError) && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="hud hud-sm overflow-hidden bg-block-tint px-4 py-3 text-sm font-medium text-block ring-1 ring-inset ring-block/40"
          >
            {formError ?? error?.message ?? connectError?.message}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Filled with brand-deep, not brand: white on #a855f7 is only 4.0:1.
          The brand violet still does the work, as the glow around it. */}
      <motion.button
        variants={row}
        onClick={
          isConnected ? submit : () => connect({ connector: connectors[0] })
        }
        disabled={busy}
        whileTap={busy ? undefined : { scale: 0.985 }}
        transition={{ duration: 0.15 }}
        className="hud hud-sm group relative w-full cursor-pointer overflow-hidden bg-brand-deep px-6 py-3.5 shadow-[0_0_34px_-4px_rgba(168,85,247,0.85)] transition-colors duration-200 hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-24 opacity-60 ${busy ? "sweep" : ""}`}
        />
        <span className="relative flex items-center justify-center gap-3 font-display text-base font-bold uppercase tracking-[0.16em] text-white">
          {!isConnected
            ? connecting
              ? "Connecting…"
              : "Connect wallet"
            : isPending
              ? "Confirm in your wallet…"
              : "Open the vault"}
          {!busy && (
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
            >
              <path d="M13.2 5.6 20 12l-6.8 6.4-1.4-1.5 4.1-3.9H4v-2h11.9l-4.1-3.9 1.4-1.5Z" />
            </svg>
          )}
        </span>
      </motion.button>

      <motion.p variants={row} className="text-center text-[11px] text-ink-dim">
        {isConnected ? (
          "You pay the deposit and the gas. Your vault, your keys — Nanny never holds them."
        ) : (
          <>
            You&apos;ll need Monad testnet MON —{" "}
            <a
              href="https://faucet.monad.xyz"
              target="_blank"
              rel="noreferrer"
              className="text-brand-text underline-offset-2 hover:underline"
            >
              get some from the faucet ↗
            </a>
          </>
        )}
      </motion.p>
    </motion.div>
  );
}
