"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { EXPLORER_TX, merchantName } from "@/lib/contract";
import { dripRateToHourlyMon, projectedAllowance, weiToMon } from "@/lib/units";
import {
  useNannyWrite,
  useNowSeconds,
  useVault,
  type SpendEntry,
  type Vault,
} from "@/lib/useNanny";

export function VaultDashboard({
  vaultId,
  spends,
  onFrozen,
  onNewVault,
}: {
  vaultId: bigint;
  spends: SpendEntry[];
  onFrozen: () => void;
  onNewVault: () => void;
}) {
  const { data, isLoading } = useVault(vaultId);
  const now = useNowSeconds();
  const { freeze, isPending } = useNannyWrite();
  const [refund, setRefund] = useState<string | null>(null);

  const vault = data as Vault | undefined;

  const allowance = useMemo(() => {
    if (!vault) return 0n;
    return projectedAllowance({
      accrued: vault.accrued,
      dripRate: vault.dripRate,
      accrualCap: vault.accrualCap,
      lastUpdate: vault.lastUpdate,
      balance: vault.balance,
      frozen: vault.frozen,
      nowSeconds: now,
    });
  }, [vault, now]);

  if (isLoading || !vault) {
    return (
      <div className="hud hud-frame">
        <div className="hud hud-body flex items-center gap-3 p-6 text-sm text-ink-soft">
          <span className="beacon h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
          Reading your vault from the chain…
        </div>
      </div>
    );
  }

  async function onFreeze() {
    if (!vault) return;
    const balance = weiToMon(vault.balance);
    try {
      await freeze(vaultId);
      setRefund(balance);
      onFrozen();
    } catch {
      /* ignore; button re-enables */
    }
  }

  const fillPct =
    vault.accrualCap > 0n
      ? Number((allowance * 1000n) / vault.accrualCap) / 10
      : 0;

  return (
    <div className="space-y-5">
      {/* Status */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="hud hud-frame"
      >
        <div className="hud hud-body p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">
                In the vault
              </div>
              <div className="mt-1 font-display text-5xl font-bold tabular-nums text-ink drop-shadow-[0_0_22px_rgba(168,85,247,0.4)]">
                {weiToMon(vault.balance)}{" "}
                <span className="text-2xl font-bold text-ink-soft">MON</span>
              </div>
              <div className="mt-1.5 text-xs text-ink-dim">
                Vault #{vaultId.toString()}
              </div>
            </div>
            <span
              className={`hud hud-sm inline-flex items-center gap-2 px-3.5 py-2 ${
                vault.frozen ? "bg-white/5" : "bg-ok-tint"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  vault.frozen ? "bg-ink-dim" : "beacon bg-ok"
                }`}
              />
              <span
                className={`font-display text-[11px] font-bold uppercase tracking-widest ${
                  vault.frozen ? "text-ink-dim" : "text-ok"
                }`}
              >
                {vault.frozen ? "Frozen" : "Watching"}
              </span>
            </span>
          </div>

          {/* Signature: the allowance drip meter */}
          <div className="hud hud-sm mt-5 bg-accent-tint/70 p-4 ring-1 ring-inset ring-accent/25">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
                Available to spend now
              </span>
              <span className="font-mono text-[11px] text-accent-deep/80">
                {dripRateToHourlyMon(vault.dripRate)} MON/hr
              </span>
            </div>
            <div className="mt-1 font-display text-4xl font-bold tabular-nums text-accent-deep drop-shadow-[0_0_18px_rgba(254,175,48,0.45)]">
              {weiToMon(allowance, 6)}{" "}
              <span className="text-lg text-accent/70">MON</span>
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-black/40">
              <div
                className="drip-fill h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
                style={{ width: `${Math.min(100, Math.max(2, fillPct))}%` }}
              />
            </div>
            <div className="mt-2 text-[11px] text-accent-deep/70">
              trickling toward a cap of {weiToMon(vault.accrualCap)} MON · max{" "}
              {weiToMon(vault.perTxCap)} per spend
            </div>
          </div>

          {!vault.frozen ? (
            <motion.button
              onClick={onFreeze}
              disabled={isPending}
              whileTap={isPending ? undefined : { scale: 0.985 }}
              transition={{ duration: 0.15 }}
              className="hud hud-sm mt-5 w-full cursor-pointer bg-block/15 px-6 py-3.5 font-display text-sm font-bold uppercase tracking-[0.14em] text-block ring-1 ring-inset ring-block/40 transition-colors duration-200 hover:bg-block hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Freezing…" : "Freeze the vault & return everything"}
            </motion.button>
          ) : (
            refund && (
              <motion.p
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="hud hud-sm mt-5 bg-ok-tint px-4 py-3 text-sm font-medium text-ok ring-1 ring-inset ring-ok/30"
              >
                Frozen. {refund} MON returned to you — instantly.
              </motion.p>
            )
          )}
        </div>
      </motion.div>

      {/* Spend log — the receipts */}
      <div className="hud hud-frame">
        <div className="hud hud-body">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div>
              <h3 className="font-display text-base font-bold uppercase tracking-wide text-ink">
                Spending log
              </h3>
              <p className="mt-0.5 text-xs text-ink-dim">
                Every payment, with the reason your agent gave.
              </p>
            </div>
            <span className="hud hud-sm bg-brand/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-brand-text">
              intent receipts
            </span>
          </div>
          {spends.length === 0 ? (
            <div className="hud hud-sm mx-6 mb-6 bg-black/20 py-8 text-center text-sm text-ink-dim">
              No spending yet. Head to the agent.
            </div>
          ) : (
            <div className="px-3 pb-3">
              <AnimatePresence initial={false}>
                {spends.map((r) => (
                  <motion.div
                    key={r.txHash}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="hud hud-sm flex items-center gap-3 px-3 py-3 transition-colors duration-200 hover:bg-white/5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold uppercase tracking-wide text-ink">
                          {merchantName(r.recipient)}
                        </span>
                        <span className="font-display font-bold tabular-nums text-accent">
                          {r.amountMon} MON
                        </span>
                      </div>
                      <div className="truncate text-sm text-ink-soft">
                        “{r.intent}”
                      </div>
                    </div>
                    <a
                      href={`${EXPLORER_TX}${r.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hud hud-sm shrink-0 bg-white/5 px-2.5 py-1.5 text-xs text-ink-soft transition-colors duration-200 hover:bg-brand/25 hover:text-brand-text"
                    >
                      verify ↗
                    </a>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onNewVault}
        className="cursor-pointer font-display text-xs font-bold uppercase tracking-[0.14em] text-ink-dim transition-colors duration-200 hover:text-brand-text"
      >
        + Open another vault
      </button>
    </div>
  );
}
