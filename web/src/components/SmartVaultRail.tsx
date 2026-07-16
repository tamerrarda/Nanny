"use client";

import Image from "next/image";
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
      <div className="hud hud-frame hud-sm hud-lift sticky top-20 backdrop-blur-xl">
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

/**
 * The vault, as a rendered isometric block.
 *
 * The art is glow on pure black with no alpha channel, so it composites with
 * `screen` rather than a cut-out: black screens to nothing and the violet
 * survives, which is exactly the shape of the source. Keying the black out to
 * transparent instead would have eaten the glow, since the glow *is* the dark
 * pixels fading toward black.
 *
 * The radial mask is not decoration: the render's grid floor runs to all four
 * edges, so without it the crop stops dead and screens in as a faint rectangle
 * floating on the panel.
 */
function VaultGlyph() {
  return (
    <div className="relative mt-3 flex h-[132px] items-center justify-center">
      <Image
        src="/vault-cube.png"
        alt=""
        width={420}
        height={420}
        className="h-full w-auto mix-blend-screen [mask-image:radial-gradient(circle_at_50%_52%,black_42%,transparent_78%)]"
      />
    </div>
  );
}
