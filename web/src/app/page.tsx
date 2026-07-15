"use client";

import Image from "next/image";
import { useState } from "react";
import { OWNER_ADDRESS } from "@/lib/contract";
import { CreateVaultForm } from "@/components/CreateVaultForm";
import { Playground } from "@/components/Playground";
import { VaultDashboard } from "@/components/VaultDashboard";
import { useNextVaultId, type SpendEntry } from "@/lib/useNanny";

export default function Home() {
  const { refetch } = useNextVaultId();
  const [tab, setTab] = useState<"dashboard" | "playground">("dashboard");
  const [spends, setSpends] = useState<SpendEntry[]>([]);

  // Always land on "open a vault". A visitor starts fresh with their own vault,
  // rather than dropping into whoever's vault was created last on-chain.
  const [activeVault, setActiveVault] = useState<bigint | null>(null);
  const latestVault = activeVault;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-16 pt-8">
      <header className="mb-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 drop-shadow-[0_6px_14px_rgba(101,68,220,0.28)]">
            <Image
              src="/nanny-owl.png"
              alt="Nanny, the watchful owl"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="font-display text-2xl font-black leading-none tracking-tight text-ink">
              Nanny
            </h1>
            <p className="mt-1 text-xs font-medium text-ink-soft">
              Your AI agent needs adult supervision.
            </p>
          </div>
        </div>
        <span className="hidden rounded-full border bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft sm:inline-flex sm:items-center sm:gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          demo · {OWNER_ADDRESS.slice(0, 6)}…{OWNER_ADDRESS.slice(-4)}
        </span>
      </header>

      {latestVault === null ? (
        <section className="overflow-hidden rounded-3xl border bg-surface shadow-[0_20px_60px_-30px_rgba(33,26,62,0.45)]">
          <div className="border-b bg-brand-tint px-6 py-5">
            <h2 className="font-display text-xl font-bold text-ink">
              Open a vault
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Give your agent an allowance — never your wallet. Set the rules
              once; Nanny enforces them on-chain, even when your agent is fooled.
            </p>
          </div>
          <div className="p-6">
            <CreateVaultForm
              onCreated={(id) => {
                setActiveVault(id);
                setSpends([]);
                setTab("playground");
                refetch();
              }}
            />
          </div>
        </section>
      ) : (
        <div className="space-y-5">
          <div className="flex gap-1 rounded-2xl border bg-surface p-1">
            {(["dashboard", "playground"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                  tab === t
                    ? "bg-brand text-white shadow-[0_6px_16px_-8px_rgba(101,68,220,0.8)]"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {t === "dashboard" ? "Dashboard" : "Agent playground"}
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
                className="text-sm font-medium text-ink-soft hover:text-brand"
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

      <footer className="mt-10 text-center text-xs text-ink-soft/70">
        You can fool the agent. You can&apos;t fool the math. · Monad testnet
      </footer>
    </main>
  );
}
