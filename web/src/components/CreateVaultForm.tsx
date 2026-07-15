"use client";

import { useState } from "react";
import type { Address } from "viem";
import { AGENT_ADDRESS, MERCHANTS } from "@/lib/contract";
import { hourlyMonToDripRate, monToWei } from "@/lib/units";
import { useNannyWrite } from "@/lib/useNanny";

type Props = {
  onCreated: (vaultId: bigint) => void;
};

const field =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100";
const label = "block text-sm font-medium text-slate-700";
const hint = "mt-1 text-xs text-slate-400";

export function CreateVaultForm({ onCreated }: Props) {
  const { createVault, isPending, error } = useNannyWrite();

  const [daily, setDaily] = useState("60");
  const [maxAccrual, setMaxAccrual] = useState("2");
  const [perTx, setPerTx] = useState("1");
  const [deposit, setDeposit] = useState("3");
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
    <div className="space-y-5">
      <div>
        <label className={label}>How much allowance per hour?</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            className={field}
            value={daily}
            onChange={(e) => setDaily(e.target.value)}
            inputMode="decimal"
          />
          <span className="text-slate-500">MON</span>
        </div>
        <p className={hint}>Trickles in second by second — not all at once.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
      </div>

      <div>
        <label className={label}>Where can it spend?</label>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {MERCHANTS.map((m) => {
            const on = chosen.includes(m.address);
            return (
              <button
                key={m.address}
                type="button"
                onClick={() => toggle(m.address)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  on
                    ? "border-pink-400 bg-pink-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="font-semibold text-slate-900">{m.name}</div>
                <div className="text-xs text-slate-500">{m.blurb}</div>
              </button>
            );
          })}
        </div>
        <p className={hint}>
          Your agent can pay only these. Anywhere else is blocked on-chain.
        </p>
      </div>

      <div>
        <label className={label}>How much to put in the vault?</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            className={field}
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            inputMode="decimal"
          />
          <span className="text-slate-500">MON</span>
        </div>
        <p className={hint}>Stays in the vault. Your agent never holds it.</p>
      </div>

      {(formError || error) && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError ?? error?.message}
        </p>
      )}

      <button
        onClick={submit}
        disabled={isPending}
        className="w-full rounded-xl bg-pink-500 px-6 py-3.5 font-semibold text-white transition hover:bg-pink-600 disabled:opacity-50"
      >
        {isPending ? "Opening…" : "Open the vault"}
      </button>
    </div>
  );
}
