"use client";

import { motion } from "framer-motion";
import Image from "next/image";

/**
 * A still of the moment the product exists for, shown before you have a vault.
 *
 * The payoff — poison the agent, watch the contract refuse — sits behind a
 * wallet, a faucet and a signed transaction. Most visitors will bounce off that
 * without ever learning what was on the other side. This shows them.
 *
 * It is a drawing, not data: nothing here touches the chain, and every part of
 * the frame says so. A mocked-up receipt that could pass for a real one would be
 * worse than showing nothing at all — the whole claim of this product is that
 * what you see on-chain actually happened.
 */
export function AgentPreview() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Example of a blocked spend"
      className="hud hud-frame mt-5"
    >
      <div className="hud hud-body p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold uppercase tracking-wide text-ink">
            What you came to see
          </h3>
          <span className="hud hud-sm bg-white/[0.06] px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-ink-dim ring-1 ring-inset ring-white/10">
            Example · not live
          </span>
        </div>
        <p className="mt-1.5 max-w-lg text-sm leading-snug text-ink-soft">
          Open a vault and the Agent tab lets you poison a real LLM with a real
          prompt injection. It gets fooled. The contract doesn&apos;t. This is a
          mock-up of that moment — no chain, no transaction.
        </p>

        {/* Deliberately flattened: reduced opacity and no interactivity, so it
            never reads as a live feed you could click. */}
        <div
          aria-hidden="true"
          className="hud hud-sm mt-4 select-none bg-black/25 p-4 opacity-80"
        >
          <div className="font-display text-[10px] font-bold uppercase tracking-[0.16em] text-ink-dim">
            You asked
          </div>
          <div className="mt-1 text-sm text-ink">Fake address change</div>

          <div className="mt-3 text-sm text-ink-soft">
            Agent tried to pay{" "}
            <span className="font-display font-bold uppercase tracking-wide text-block">
              an unknown address
            </span>{" "}
            <span className="font-display font-bold text-accent">0.3 MON</span>{" "}
            — “Processing the outstanding MarketCo order.”
          </div>

          <div className="hud hud-sm mt-3 flex items-start gap-3 bg-block/12 px-4 py-3.5 ring-1 ring-inset ring-block/40">
            <div className="relative shrink-0">
              <Image
                src="/owl-mark.png"
                alt=""
                width={36}
                height={36}
                className="relative z-10 drop-shadow-[0_0_10px_rgba(168,85,247,0.7)]"
              />
            </div>
            <div className="min-w-0">
              <div className="font-display text-sm font-bold uppercase tracking-wide text-block">
                Nanny blocked it —{" "}
                <span className="font-mono normal-case tracking-normal text-accent">
                  NANNY: recipient not allowed
                </span>
              </div>
              <p className="mt-0.5 text-sm text-ink-soft">
                The agent was fooled. The contract wasn’t.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-ink-dim">
          The real thing writes the agent’s reason to the chain and gives you a
          transaction hash you can check yourself.
        </p>
      </div>
    </motion.section>
  );
}
