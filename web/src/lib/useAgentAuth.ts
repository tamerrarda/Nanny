"use client";

import { useCallback, useRef } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { monadTestnet } from "wagmi/chains";
import { AUTH_TTL_MS, buildAuthMessage, type AgentAuth } from "./agentAuth";

/** Re-sign a little before the server would start rejecting it, so a long
 *  session never fails mid-request on a clock skew. */
const RENEW_MARGIN_MS = 60_000;

type Cached = AgentAuth & { expiresAt: number; vaultId: string };

/**
 * Gets — and reuses — the owner's signature authorising the demo agent on a
 * vault. Cached in memory for the vault's lifetime, so the wallet prompts once
 * per vault rather than once per message: a popup on every attack button would
 * make the demo unusable, and the security property is the same either way.
 */
export function useAgentAuth() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const cache = useRef<Cached | null>(null);

  return useCallback(
    async (vaultId: bigint): Promise<AgentAuth> => {
      if (!address) throw new Error("Connect a wallet first.");
      const id = vaultId.toString();

      const hit = cache.current;
      if (
        hit &&
        hit.vaultId === id &&
        hit.address.toLowerCase() === address.toLowerCase() &&
        hit.expiresAt - RENEW_MARGIN_MS > Date.now()
      ) {
        return { address: hit.address, message: hit.message, signature: hit.signature };
      }

      const issuedAt = Date.now();
      const expiresAt = issuedAt + AUTH_TTL_MS;
      const message = buildAuthMessage({
        vaultId: id,
        owner: address,
        chainId: monadTestnet.id,
        issuedAt,
        expiresAt,
      });
      const signature = await signMessageAsync({ message });

      cache.current = { address, message, signature, expiresAt, vaultId: id };
      return { address, message, signature };
    },
    [address, signMessageAsync],
  );
}
