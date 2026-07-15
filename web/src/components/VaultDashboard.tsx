"use client";

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
}: {
  vaultId: bigint;
  spends: SpendEntry[];
  onFrozen: () => void;
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
    return <div className="text-slate-400">Loading your vault…</div>;
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
      {/* Status card */}
      <div className="rounded-3xl border bg-surface p-6 shadow-[0_20px_60px_-30px_rgba(33,26,62,0.45)]">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-ink-soft">
              In the vault
            </div>
            <div className="font-display text-4xl font-black text-ink">
              {weiToMon(vault.balance)}{" "}
              <span className="text-xl font-bold text-ink-soft">MON</span>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              vault.frozen
                ? "bg-canvas-2 text-ink-soft"
                : "bg-ok-tint text-ok"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                vault.frozen ? "bg-ink-soft" : "bg-ok"
              }`}
            />
            {vault.frozen ? "Frozen" : "Watching"}
          </span>
        </div>

        {/* Signature: the allowance drip meter */}
        <div className="mt-5 rounded-2xl bg-accent-tint p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-deep">
              Available to spend now
            </span>
            <span className="text-xs text-ink-soft">
              {dripRateToHourlyMon(vault.dripRate)} MON/hr
            </span>
          </div>
          <div className="mt-1 font-display text-3xl font-black tabular-nums text-ink">
            {weiToMon(allowance, 6)}{" "}
            <span className="text-base font-bold text-ink-soft">MON</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/70">
            <div
              className="drip-fill h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
              style={{ width: `${Math.min(100, Math.max(2, fillPct))}%` }}
            />
          </div>
          <div className="mt-1.5 text-xs text-accent-deep">
            trickling toward a cap of {weiToMon(vault.accrualCap)} MON · max{" "}
            {weiToMon(vault.perTxCap)} per spend
          </div>
        </div>

        {!vault.frozen ? (
          <button
            onClick={onFreeze}
            disabled={isPending}
            className="mt-5 w-full rounded-2xl border-2 border-block/20 bg-block-tint px-6 py-3 text-base font-bold text-block transition hover:bg-block hover:text-white disabled:opacity-50"
          >
            {isPending ? "Freezing…" : "Freeze the vault & return everything"}
          </button>
        ) : (
          refund && (
            <p className="mt-5 rounded-2xl bg-ok-tint px-4 py-3 text-sm font-medium text-ok">
              Frozen. {refund} MON returned to you — instantly.
            </p>
          )
        )}
      </div>

      {/* Spend log — deliberately a serious, dark "bank statement" panel */}
      <div className="overflow-hidden rounded-3xl bg-ink text-white shadow-[0_20px_60px_-30px_rgba(33,26,62,0.6)]">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold">Spending log</h3>
            <p className="text-xs text-white/50">
              Every payment, with the reason your agent gave.
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-white/60">
            intent receipts
          </span>
        </div>
        {spends.length === 0 ? (
          <div className="mx-6 mb-6 rounded-2xl border border-white/10 py-8 text-center text-sm text-white/40">
            No spending yet. Head to the playground.
          </div>
        ) : (
          <div className="px-2 pb-2">
            {spends.map((r) => (
              <div
                key={r.txHash}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 transition hover:bg-white/5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {merchantName(r.recipient)}
                    </span>
                    <span className="tabular-nums text-accent">
                      {r.amountMon} MON
                    </span>
                  </div>
                  <div className="truncate text-sm text-white/55">
                    “{r.intent}”
                  </div>
                </div>
                <a
                  href={`${EXPLORER_TX}${r.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white/80 transition hover:bg-white/20"
                >
                  verify ↗
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
