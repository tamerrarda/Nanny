"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import { EXPLORER_ADDRESS, NANNY_VAULT_ADDRESS } from "@/lib/contract";
import { ConnectWallet } from "@/components/ConnectWallet";
import { AgentPreview } from "@/components/AgentPreview";
import { CreateVaultForm } from "@/components/CreateVaultForm";
import { Playground } from "@/components/Playground";
import { Sidebar, type Tab } from "@/components/Sidebar";
import { SmartVaultRail } from "@/components/SmartVaultRail";
import { VaultDashboard } from "@/components/VaultDashboard";
import { AetherHero, AuroraCanvas } from "@/components/ui/aether-hero";
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
      <AuroraBackdrop />

      <AetherHero
        // The page paints the aurora now, edge to edge and behind everything.
        backdrop={false}
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

      <div id="app" className="relative flex-1 scroll-mt-16">
        <AppAmbient />

        <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-5 pb-10">
          <div className="flex flex-1 items-start gap-5">
            <Reveal delay={0.05}>
              <Sidebar
                tab={view}
                setTab={setTab}
                unlocked={activeVault !== null}
              />
            </Reveal>

            <main className="min-w-0 flex-1">
              {/* Keyed so switching tabs animates as a replacement rather than
                  a silent swap — the panel is the thing that changed. */}
              <AnimatePresence mode="wait">
                {view === "vault" && (
                  <TabPanel key="vault">
                    <div className="hud hud-frame hud-lift">
                    <div className="hud hud-body hud-ticks p-5 sm:p-6">
                      <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-ink">
                        Open a vault
                      </h2>
                      <p className="mt-1 max-w-lg text-sm leading-snug text-ink-soft">
                        Give your agent an allowance — never your wallet. Set the
                        rules once; Nanny enforces them on-chain, even when your
                        agent is fooled.
                      </p>
                      {/* Says out loud what the padlocks to the left mean. The
                          sidebar only had a `title` tooltip, which never fires
                          on touch and is slow everywhere else. */}
                      <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-ink-dim">
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden="true"
                          className="h-3 w-3 shrink-0"
                        >
                          <path d="M12 2a5 5 0 0 1 5 5v2h1.5A1.5 1.5 0 0 1 20 10.5v9A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5v-9A1.5 1.5 0 0 1 5.5 9H7V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v2h6V7a3 3 0 0 0-3-3Z" />
                        </svg>
                        Activity and Agent unlock once your vault exists — they
                        both act on a specific vault.
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
                    </div>

                    <AgentPreview />
                  </TabPanel>
                )}

                {view === "activity" && activeVault !== null && (
                  <TabPanel key="activity">
                    <VaultDashboard
                      vaultId={activeVault}
                      spends={spends}
                      onFrozen={() => refetch()}
                      onNewVault={() => {
                        setActiveVault(null);
                        setTab("vault");
                      }}
                    />
                  </TabPanel>
                )}

                {view === "agent" && activeVault !== null && (
                  <TabPanel key="agent">
                    <Playground
                      vaultId={activeVault}
                      onSpend={(e) => setSpends((prev) => [e, ...prev])}
                    />
                  </TabPanel>
                )}
              </AnimatePresence>
            </main>

            <Reveal delay={0.14}>
              <SmartVaultRail />
            </Reveal>
          </div>

          {/*
            The three things that used to live in a sticky bar. The bar is gone,
            so they land where each actually belongs: the wordmark anchors the
            page's foot, the wallet chip and faucet are session utilities, and
            the act of connecting moved into the form's own button — the place
            you find out you need a wallet is the place you should get one.
          */}
          <footer className="mt-12 border-t border-white/10 pt-5">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
              <a
                href="#"
                className="flex items-center gap-2.5 transition-opacity duration-200 hover:opacity-80"
              >
                <Image
                  src="/owl-mark.png"
                  alt=""
                  width={24}
                  height={24}
                  className="drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]"
                />
                {/* Tracked out, not tight: caps set at their lowercase spacing
                    read as cramped, and every other uppercase run in this UI
                    is spaced. */}
                <span className="font-display text-base font-bold tracking-[0.14em] text-ink">
                  NANNY
                </span>
              </a>

              <p className="order-last text-center text-xs text-ink-dim sm:order-none">
                You can fool the agent. You can&apos;t fool the math. · Monad
                testnet
              </p>

              <ConnectWallet />
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}

/**
 * The aurora, promoted from the hero to the whole page.
 *
 * One fixed canvas behind everything, rather than a second one for the app
 * section: two would mean two WebGL contexts drawing the same shader, and the
 * seam where the hero ended would be visible. Fixed rather than scrolling, so
 * the rays read as a field the page moves over.
 *
 * The cost is real and deliberate: unlike the old hero canvas, this never
 * scrolls out of view, so it renders the whole time the tab is visible.
 */
function AuroraBackdrop() {
  const use3D = useOwl3DReady(); // same gate: hydrated, and motion is welcome

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      {/* Painted always, so reduced motion and dead WebGL get still art. */}
      <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_10%,#3b1178_0%,transparent_65%),radial-gradient(55%_50%_at_12%_70%,#2a1361_0%,transparent_60%)]" />
      {use3D && <AuroraCanvas className="absolute inset-0" />}
      <div className="app-grid absolute inset-0" />
    </div>
  );
}

/** Darkens the aurora under the app's panels so text keeps its contrast. */
function AppAmbient() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(7,5,15,0.55)_0%,rgba(7,5,15,0.68)_40%,rgba(7,5,15,0.82)_100%)]"
    />
  );
}

/** A view swap inside the main column. Exit is faster than enter: the thing
 *  leaving has already stopped being useful. */
function TabPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
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
