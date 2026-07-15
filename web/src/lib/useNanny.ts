"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { useReadContract } from "wagmi";
import { NANNY_VAULT_ADDRESS, nannyVaultAbi } from "./contract";

export type Vault = {
  owner: Address;
  agent: Address;
  balance: bigint;
  dripRate: bigint;
  accrued: bigint;
  lastUpdate: bigint;
  accrualCap: bigint;
  perTxCap: bigint;
  frozen: boolean;
};

const base = {
  address: NANNY_VAULT_ADDRESS,
  abi: nannyVaultAbi,
} as const;

/** Read a vault's full state. Refetches on the given key changing. */
export function useVault(vaultId: bigint | undefined) {
  return useReadContract({
    ...base,
    functionName: "getVault",
    args: vaultId === undefined ? undefined : [vaultId],
    query: { enabled: vaultId !== undefined, refetchInterval: 5_000 },
  });
}

/** The next vault id — also the count of vaults ever created. */
export function useNextVaultId() {
  return useReadContract({ ...base, functionName: "nextVaultId" });
}

async function ownerAction(payload: Record<string, unknown>) {
  const res = await fetch("/api/owner", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error ?? "Action failed");
  return data;
}

/**
 * Owner write actions, dispatched through the server-side demo owner wallet
 * (POST /api/owner). bigints are sent as strings since JSON can't carry them.
 * Returns a small pending/error state the forms share.
 */
export function useNannyWrite() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  function wrap<T>(fn: () => Promise<T>) {
    return async () => {
      setIsPending(true);
      setError(null);
      try {
        return await fn();
      } catch (e) {
        const err = e instanceof Error ? e : new Error("Action failed");
        setError(err);
        throw err;
      } finally {
        setIsPending(false);
      }
    };
  }

  return {
    isPending,
    error,
    createVault: (args: {
      agent: Address;
      dripRate: bigint;
      accrualCap: bigint;
      perTxCap: bigint;
      recipients: Address[];
      deposit: bigint;
    }) =>
      wrap(() =>
        ownerAction({
          action: "create",
          agent: args.agent,
          dripRate: args.dripRate.toString(),
          accrualCap: args.accrualCap.toString(),
          perTxCap: args.perTxCap.toString(),
          recipients: args.recipients,
          deposit: args.deposit.toString(),
        }),
      )(),
    deposit: (vaultId: bigint, amount: bigint) =>
      wrap(() =>
        ownerAction({
          action: "deposit",
          vaultId: vaultId.toString(),
          amount: amount.toString(),
        }),
      )(),
    freeze: (vaultId: bigint) =>
      wrap(() =>
        ownerAction({ action: "freeze", vaultId: vaultId.toString() }),
      )(),
  };
}

/**
 * A spend the agent made this session. Recorded from the /api/agent response
 * rather than by polling Spent events: Monad's RPC caps eth_getLogs at a
 * 100-block range and blocks are fast, so a wide event scan 413s. Shared state
 * is instant and reliable for the live demo; historical indexing (monskills
 * HyperIndex) is the production path noted in the README.
 */
export type SpendEntry = {
  recipient: string;
  amountMon: number;
  intent: string;
  txHash: string;
};

/** A once-per-second clock, for ticking the allowance counter without polling. */
export function useNowSeconds() {
  const [now, setNow] = useState<bigint>(() =>
    BigInt(Math.floor(Date.now() / 1000)),
  );
  useEffect(() => {
    const t = setInterval(
      () => setNow(BigInt(Math.floor(Date.now() / 1000))),
      1_000,
    );
    return () => clearInterval(t);
  }, []);
  return now;
}
