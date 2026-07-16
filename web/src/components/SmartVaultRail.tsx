"use client";

import {
  CHAIN_ID,
  EXPLORER_ADDRESS,
  NANNY_VAULT_ADDRESS,
} from "@/lib/contract";
import { useNextVaultId } from "@/lib/useNanny";

/**
 * The right rail is a live readout of the contract that backs this page, not a
 * decorative badge: the vault count is read from the chain, the address links
 * to the verified source, and the status dot reflects whether the read
 * actually succeeded. If the RPC is down, it says so instead of lying green.
 */
export function SmartVaultRail() {
  const { data, isLoading, isError } = useNextVaultId();
  const vaultCount = typeof data === "bigint" ? data : undefined;

  const state = isLoading
    ? { label: "Connecting", tone: "text-ink-soft", dot: "bg-ink-soft" }
    : isError
      ? { label: "RPC unreachable", tone: "text-block", dot: "bg-block" }
      : { label: "Active", tone: "text-ok", dot: "bg-ok beacon" };

  return (
    <aside className="hidden w-[232px] shrink-0 xl:block">
      <div className="hud hud-frame hud-sm sticky top-20">
        <div className="hud hud-body hud-sm p-5">
          <div className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">
            Smart Vault
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${state.dot}`} />
            <span
              className={`font-display text-[11px] font-bold uppercase tracking-widest ${state.tone}`}
            >
              {state.label}
            </span>
          </div>

          <VaultGlyph />

          <div className="mt-4 space-y-3">
            <Stat
              label="Vaults opened"
              value={vaultCount === undefined ? "—" : vaultCount.toString()}
            />
            <Stat label="Chain" value={`Monad · ${CHAIN_ID}`} />
          </div>

          <a
            href={`${EXPLORER_ADDRESS}${NANNY_VAULT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="hud hud-sm mt-4 block bg-brand/12 px-3 py-2.5 transition-colors duration-200 hover:bg-brand/25"
          >
            <div className="text-[10px] font-medium uppercase tracking-widest text-ink-dim">
              Contract
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-brand-text">
              {NANNY_VAULT_ADDRESS.slice(0, 10)}…{NANNY_VAULT_ADDRESS.slice(-6)}
            </div>
            <div className="mt-1 text-[10px] text-ink-soft">
              read the source ↗
            </div>
          </a>

          <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-brand-text"
            >
              <path d="M12 2 3 12l9 10 9-10-9-10Zm0 3.4 6.1 6.6-6.1 6.6L5.9 12 12 5.4Z" />
            </svg>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-ink-dim">
                Protected by
              </div>
              <div className="font-display text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                Monad Testnet
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] uppercase tracking-widest text-ink-dim">
        {label}
      </span>
      <span className="font-display text-sm font-bold tabular-nums text-ink">
        {value}
      </span>
    </div>
  );
}

/** An isometric vault plate, drawn rather than rendered — no asset to ship. */
function VaultGlyph() {
  return (
    <div className="relative mt-4 flex h-[104px] items-center justify-center">
      <div className="absolute bottom-1 h-5 w-28 rounded-[50%] bg-brand/45 blur-lg" />
      <div className="pedestal absolute bottom-2 h-2.5 w-20 rounded-[50%] bg-brand/70 blur-[6px]" />
      <svg viewBox="0 0 120 100" className="relative h-full w-full">
        <defs>
          <linearGradient id="rail-face" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {/* Base platform */}
        <path
          d="M60 62 24 78 60 94 96 78 60 62Z"
          fill="url(#rail-face)"
          stroke="#a855f7"
          strokeOpacity="0.7"
        />
        {/* Body */}
        <path
          d="M60 22 30 36v22l30 14 30-14V36L60 22Z"
          fill="url(#rail-face)"
          stroke="#c084fc"
          strokeOpacity="0.85"
        />
        <path
          d="M60 22 30 36l30 14 30-14-30-14Z"
          fill="#a855f7"
          fillOpacity="0.28"
          stroke="#c084fc"
          strokeOpacity="0.6"
        />
        {/* Shackle + keyhole */}
        <path
          d="M54 40v-4a6 6 0 0 1 12 0v4"
          fill="none"
          stroke="#feaf30"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="60" cy="50" r="3.5" fill="#feaf30" />
        <rect x="58.6" y="50" width="2.8" height="7" fill="#feaf30" rx="1.4" />
      </svg>
    </div>
  );
}
