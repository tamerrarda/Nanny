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

  return (
    <div className="space-y-6">
      {/* Status card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-slate-500">In the vault</div>
            <div className="text-3xl font-bold text-slate-900">
              {weiToMon(vault.balance)} <span className="text-lg">MON</span>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              vault.frozen
                ? "bg-slate-200 text-slate-600"
                : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {vault.frozen ? "Frozen" : "Active"}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-pink-50 p-4">
            <div className="text-xs text-pink-700">Available to spend now</div>
            <div className="font-mono text-2xl font-semibold text-pink-900 tabular-nums">
              {weiToMon(allowance, 6)}
            </div>
            <div className="mt-1 text-xs text-pink-600">
              {dripRateToHourlyMon(vault.dripRate)} MON/hour, trickling in
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Most it can save up</div>
            <div className="text-2xl font-semibold text-slate-800">
              {weiToMon(vault.accrualCap)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Max {weiToMon(vault.perTxCap)} per spend
            </div>
          </div>
        </div>

        {!vault.frozen && (
          <button
            onClick={onFreeze}
            disabled={isPending}
            className="mt-6 w-full rounded-xl bg-red-500 px-6 py-3.5 text-lg font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
          >
            {isPending ? "Freezing…" : "🛑 Freeze the vault"}
          </button>
        )}
        {refund && (
          <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Frozen. {refund} MON returned to you.
          </p>
        )}
      </div>

      {/* Spend log */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Spending log</h3>
        <p className="text-sm text-slate-400">
          Every payment, with the reason your agent gave — like a bank statement.
        </p>
        {spends.length === 0 ? (
          <div className="mt-4 rounded-xl bg-slate-50 py-10 text-center text-sm text-slate-400">
            No spending yet.
          </div>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="pb-2">To</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Reason</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {spends.map((r) => (
                <tr key={r.txHash} className="border-t border-slate-100">
                  <td className="py-2 font-medium text-slate-800">
                    {merchantName(r.recipient)}
                  </td>
                  <td className="py-2 tabular-nums text-slate-800">
                    {r.amountMon} MON
                  </td>
                  <td className="py-2 text-slate-600">{r.intent}</td>
                  <td className="py-2 text-right">
                    <a
                      href={`${EXPLORER_TX}${r.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-pink-600 hover:underline"
                    >
                      verify ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
