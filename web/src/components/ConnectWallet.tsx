"use client";

import { motion } from "framer-motion";
import { useSyncExternalStore } from "react";
import { useAccount, useDisconnect, useSwitchChain } from "wagmi";
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

/**
 * Wallet status for the footer. Connecting itself lives on the form's primary
 * button — this only reports where you stand once you have a wallet.
 */
export function ConnectWallet() {
  const mounted = useMounted();
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const hasWallet =
    mounted && typeof window !== "undefined" && "ethereum" in window;

  if (!mounted) {
    // Placeholder at the real size, so the footer doesn't jump on hydration.
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

  // Nothing to say while disconnected: the form's primary button is the connect
  // action now, and a second "Connect wallet" down here only makes you wonder
  // which of the two is the real one.
  if (!isConnected) return null;

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
