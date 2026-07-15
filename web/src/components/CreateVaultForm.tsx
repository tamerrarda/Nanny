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
  "w-full rounded-xl border bg-canvas/60 px-4 py-2.5 text-ink outline-none transition focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand/10";
const label = "block text-sm font-semibold text-ink";
const hint = "mt-1 text-xs text-ink-soft";

export function CreateVaultForm({ onCreated }: Props) {
  const { createVault, isPending, error } = useNannyWrite();

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
    <div className="space-y-4">
      <div>
        <label className={label}>How much allowance per hour?</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            className={field}
            value={daily}
            onChange={(e) => setDaily(e.target.value)}
            inputMode="decimal"
          />
          <span className="font-medium text-ink-soft">MON</span>
        </div>
        <p className={hint}>Trickles in second by second — not all at once.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                className={`rounded-xl border px-4 py-2.5 text-left transition ${
                  on
                    ? "border-brand bg-brand-tint ring-2 ring-brand/15"
                    : "bg-canvas/50 hover:border-brand/40"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-ink">
                  {m.name}
                  {on && <span className="text-brand">✓</span>}
                </div>
                <div className="text-xs text-ink-soft">{m.blurb}</div>
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
          <span className="font-medium text-ink-soft">MON</span>
        </div>
        <p className={hint}>Stays in the vault. Your agent never holds it.</p>
      </div>

      {(formError || error) && (
        <p className="rounded-xl bg-block-tint px-4 py-3 text-sm font-medium text-block">
          {formError ?? error?.message}
        </p>
      )}

      <button
        onClick={submit}
        disabled={isPending}
        className="w-full rounded-xl bg-brand px-6 py-3.5 font-semibold text-white shadow-[0_10px_24px_-10px_rgba(101,68,220,0.9)] transition hover:bg-brand-deep disabled:opacity-50"
      >
        {isPending ? "Opening…" : "Open the vault"}
      </button>
    </div>
  );
}
