"use client";

import { useState } from "react";
import { OWNER_ADDRESS } from "@/lib/contract";
import { CreateVaultForm } from "@/components/CreateVaultForm";
import { Playground } from "@/components/Playground";
import { VaultDashboard } from "@/components/VaultDashboard";
import { useNextVaultId, type SpendEntry } from "@/lib/useNanny";

export default function Home() {
  const { data: nextId, refetch } = useNextVaultId();
  const [tab, setTab] = useState<"dashboard" | "playground">("dashboard");

  // Spends made this session, shared between the playground (which records them)
  // and the dashboard (which shows the receipts).
  const [spends, setSpends] = useState<SpendEntry[]>([]);

  // The vault this session is looking at. Defaults to the most recent one.
  const [activeVault, setActiveVault] = useState<bigint | null>(null);
  const latestVault =
    activeVault ??
    (typeof nextId === "bigint" && nextId > 0n ? nextId - 1n : null);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
            <span>🍼</span> Nanny
          </div>
          <p className="text-sm text-slate-500">
            Your AI agent needs adult supervision.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
          demo wallet · {OWNER_ADDRESS.slice(0, 6)}…{OWNER_ADDRESS.slice(-4)}
        </span>
      </header>

      {latestVault === null ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-xl font-bold text-slate-900">Open a vault</h2>
          <p className="mb-6 text-sm text-slate-500">
            Give your agent an allowance — not your wallet. Set the rules once;
            your agent lives inside them, enforced on-chain.
          </p>
          <CreateVaultForm
            onCreated={(id) => {
              setActiveVault(id);
              setSpends([]);
              setTab("playground");
              refetch();
            }}
          />
        </section>
      ) : (
        <div className="space-y-6">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {(["dashboard", "playground"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                  tab === t
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === "dashboard" ? "🏠 Dashboard" : "🤖 Agent playground"}
              </button>
            ))}
          </div>

          {tab === "dashboard" ? (
            <>
              <VaultDashboard
                vaultId={latestVault}
                spends={spends}
                onFrozen={() => refetch()}
              />
              <button
                onClick={() => setActiveVault(null)}
                className="text-sm text-slate-400 hover:text-slate-600 hover:underline"
              >
                + Open another vault
              </button>
            </>
          ) : (
            <Playground
              vaultId={latestVault}
              onSpend={(e) => setSpends((prev) => [e, ...prev])}
            />
          )}
        </div>
      )}
    </main>
  );
}
