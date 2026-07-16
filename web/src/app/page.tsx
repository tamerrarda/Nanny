"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import { EXPLORER_ADDRESS, NANNY_VAULT_ADDRESS } from "@/lib/contract";
import { ConnectWallet } from "@/components/ConnectWallet";
import { CreateVaultForm } from "@/components/CreateVaultForm";
import { Playground } from "@/components/Playground";
import { Sidebar, type Tab } from "@/components/Sidebar";
import { SmartVaultRail } from "@/components/SmartVaultRail";
import { VaultDashboard } from "@/components/VaultDashboard";
import { AetherHero } from "@/components/ui/aether-hero";
import { useOwl3DReady } from "@/components/ui/owl-3d";
import { useNextVaultId, type SpendEntry } from "@/lib/useNanny";

// three.js is ~150KB gzipped — it must never land in the initial bundle, and it
// is useless on the server, so the whole mascot is client-only and lazy.
const Owl3D = dynamic(
  () => import("@/components/ui/owl-3d").then((m) => m.Owl3D),
  { ssr: false },
);

export default function Home() {
  const { refetch } = useNextVaultId();
  const [tab, setTab] = useState<Tab>("vault");
  const [spends, setSpends] = useState<SpendEntry[]>([]);

  // Always land on "open a vault". A visitor starts fresh with their own vault,
  // rather than dropping into whoever's vault was created last on-chain.
  const [activeVault, setActiveVault] = useState<bigint | null>(null);

  // Activity and Agent are only reachable once there is a vault to act on.
  const view = activeVault === null ? "vault" : tab;

  return (
    <>
      <AetherHero
        ctaLabel="Open a vault"
        ctaHref="#app"
        secondaryCtaLabel="Read the contract ↗"
        secondaryCtaHref={`${EXPLORER_ADDRESS}${NANNY_VAULT_ADDRESS}`}
        eyebrow={<HeroMascot />}
        title={
          <>
            Your AI agent needs{" "}
            <span className="text-brand-text drop-shadow-[0_0_38px_rgba(168,85,247,0.65)]">
              adult supervision
            </span>
            .
          </>
        }
        subtitle={
          // Exo 2 rather than the body face. Passed as a node instead of taught
          // to AetherHero, so the hero component stays brand-agnostic.
          <span className="font-lede">
            Give your agent an allowance — never your wallet. Set the rules once;
            Nanny enforces them on-chain, even when your agent is fooled.
          </span>
        }
      >
        <ScrollCue />
      </AetherHero>

      <AppBar />

      <div
        id="app"
        className="mx-auto flex w-full max-w-[1200px] flex-1 scroll-mt-16 flex-col px-5 pb-10"
      >
        <div className="flex flex-1 items-start gap-5">
          <Sidebar tab={view} setTab={setTab} unlocked={activeVault !== null} />

          <main className="min-w-0 flex-1">
            {view === "vault" && (
              <Reveal className="hud hud-frame">
                <div className="hud hud-body p-5 sm:p-6">
                  <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-ink">
                    Open a vault
                  </h2>
                  <p className="mt-1 max-w-lg text-sm leading-snug text-ink-soft">
                    Give your agent an allowance — never your wallet. Set the
                    rules once; Nanny enforces them on-chain, even when your
                    agent is fooled.
                  </p>
                  <div className="mt-4">
                    <CreateVaultForm
                      onCreated={(id) => {
                        setActiveVault(id);
                        setSpends([]);
                        setTab("agent");
                        refetch();
                      }}
                    />
                  </div>
                </div>
              </Reveal>
            )}

            {view === "activity" && activeVault !== null && (
              <VaultDashboard
                vaultId={activeVault}
                spends={spends}
                onFrozen={() => refetch()}
                onNewVault={() => {
                  setActiveVault(null);
                  setTab("vault");
                }}
              />
            )}

            {view === "agent" && activeVault !== null && (
              <Playground
                vaultId={activeVault}
                onSpend={(e) => setSpends((prev) => [e, ...prev])}
              />
            )}
          </main>

          <SmartVaultRail />
        </div>

        <footer className="mt-10 text-center text-xs text-ink-dim">
          You can fool the agent. You can&apos;t fool the math. · Monad testnet
        </footer>
      </div>
    </>
  );
}

/**
 * The owl, lit from below, floating over the shader. Renders as a real 3D model
 * that tracks the pointer once the client is up; falls back to the flat PNG on
 * the server and for anyone who asked for reduced motion, so the mascot is
 * never absent — only ever flat.
 */
function HeroMascot() {
  const use3D = useOwl3DReady();

  return (
    <div className="relative mx-auto h-[168px] w-[168px]">
      {use3D ? (
        <div className="absolute inset-0 z-10 drop-shadow-[0_0_30px_rgba(168,85,247,0.55)]">
          <Owl3D />
        </div>
      ) : (
        <motion.div
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="relative flex h-full items-center justify-center"
        >
          <Image
            src="/owl-mark.png"
            alt="Nanny, the watchful owl"
            width={116}
            height={116}
            className="relative z-10 drop-shadow-[0_0_28px_rgba(168,85,247,0.7)]"
            priority
          />
        </motion.div>
      )}
      <div className="pedestal absolute bottom-3 left-1/2 h-3.5 w-24 -translate-x-1/2 rounded-[50%] bg-brand/80 blur-md" />
      <div className="absolute bottom-2 left-1/2 h-6 w-28 -translate-x-1/2 rounded-[50%] bg-brand/35 blur-lg" />
    </div>
  );
}

function ScrollCue() {
  return (
    <div className="mt-14 flex justify-center">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        className="cue-drift h-5 w-5 text-ink-dim"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

/**
 * Compact bar for the app half of the page. The mascot and the headline live in
 * the hero now, so this only has to say "you are in the product" and show the
 * demo identity you are acting as.
 */
function AppBar() {
  return (
    // Full-bleed: the blur has to run edge to edge, or the page shows through
    // unblurred either side of the bar as you scroll.
    <header className="sticky top-0 z-30 mb-5 w-full border-b border-white/5 bg-canvas/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-5 py-3">
        <a
          href="#"
          className="flex items-center gap-2.5 transition-opacity duration-200 hover:opacity-80"
        >
          <Image
            src="/owl-mark.png"
            alt=""
            width={28}
            height={28}
            className="drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]"
          />
          <span className="font-display text-lg font-bold tracking-tight text-ink">
            Nanny
          </span>
        </a>

        <ConnectWallet />
      </div>
    </header>
  );
}

/** Scroll-triggered reveal. Fires once — re-animating on every scroll-by is noise. */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
