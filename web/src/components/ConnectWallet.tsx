"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSyncExternalStore } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { monadTestnet } from "wagmi/chains";

const subscribeNever = () => () => {};

/** wagmi's connection state only exists on the client, so anything derived from
 *  it has to wait for hydration or the server and client markup disagree. */
function useMounted() {
  return useSyncExternalStore(
    subscribeNever,
    () => true, // client
    () => false, // server
  );
}

const chip =
  "hud hud-sm flex min-h-9 cursor-pointer items-center gap-2 px-3.5 py-2 font-display text-xs font-bold uppercase tracking-widest transition-colors duration-200";

export function ConnectWallet() {
  const mounted = useMounted();
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  // `injected` is always in the list even with no wallet installed, so its
  // presence proves nothing — ask the provider itself.
  const injected = connectors[0];
  const hasWallet =
    mounted && typeof window !== "undefined" && "ethereum" in window;

  if (!mounted) {
    // Placeholder at the real size, so the bar doesn't jump on hydration.
    return <div className="h-9 w-[148px]" aria-hidden="true" />;
  }

  if (!hasWallet) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        className={`${chip} bg-white/[0.04] text-ink-soft ring-1 ring-inset ring-white/10 hover:bg-white/10 hover:text-ink`}
      >
        Install a wallet ↗
      </a>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-end gap-1">
        <motion.button
          onClick={() => connect({ connector: injected })}
          disabled={isPending}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className={`${chip} bg-brand-deep text-white shadow-[0_0_26px_-8px_rgba(168,85,247,0.9)] hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isPending ? "Connecting…" : "Connect wallet"}
        </motion.button>
        <AnimatePresence>
          {error && (
            <motion.span
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-[220px] text-right text-[10px] text-block"
            >
              {error.message}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Connected, but pointed at some other chain — the vault does not exist there.
  if (chainId !== monadTestnet.id) {
    return (
      <motion.button
        onClick={() => switchChain({ chainId: monadTestnet.id })}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.15 }}
        className={`${chip} bg-block/15 text-block ring-1 ring-inset ring-block/40 hover:bg-block hover:text-white`}
      >
        Switch to Monad
      </motion.button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href="https://faucet.monad.xyz"
        target="_blank"
        rel="noreferrer"
        title="Get Monad testnet MON"
        className={`${chip} bg-white/[0.04] text-ink-dim ring-1 ring-inset ring-white/10 hover:bg-white/10 hover:text-ink`}
      >
        Faucet ↗
      </a>
      <button
        onClick={() => disconnect()}
        title="Disconnect"
        className={`${chip} group bg-white/[0.04] text-ink-soft ring-1 ring-inset ring-white/10 hover:bg-white/10 hover:text-ink`}
      >
        <span className="beacon h-1.5 w-1.5 rounded-full bg-ok" />
        <span className="font-sans text-xs normal-case tracking-normal">
          {address?.slice(0, 6)}…{address?.slice(-4)}
        </span>
      </button>
    </div>
  );
}
