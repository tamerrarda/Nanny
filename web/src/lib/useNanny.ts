"use client";

import { useEffect, useState } from "react";
import { decodeEventLog, type Address, type Hash } from "viem";
import {
  useAccount,
  useConfig,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { monadTestnet } from "wagmi/chains";
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

/** Reads the new vault's id straight out of the receipt.
 *
 *  The old server path derived it as `nextVaultId - 1` after the write. That was
 *  only ever safe because one key made every vault: with real wallets, two people
 *  opening a vault in the same block would both read the same counter and one
 *  would be handed the other's vault. The VaultCreated log is the tx's own
 *  result, so it cannot be raced.
 */
function vaultIdFromReceipt(logs: readonly { data: Hash; topics: string[] }[]) {
  for (const log of logs) {
    try {
      const parsed = decodeEventLog({
        abi: nannyVaultAbi,
        data: log.data,
        topics: log.topics as [signature: Hash, ...args: Hash[]],
      });
      if (parsed.eventName === "VaultCreated") {
        return (parsed.args as unknown as { vaultId: bigint }).vaultId;
      }
    } catch {
      // Not one of ours — the receipt can carry logs from other contracts.
    }
  }
  throw new Error("Vault was created but its id was not in the receipt.");
}

/**
 * Owner write actions, signed by the connected wallet. Same surface the forms
 * already used when this went through the server, so callers only had to learn
 * about `isConnected`.
 */
export function useNannyWrite() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { writeContractAsync } = useWriteContract();
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const config = useConfig();

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    setIsPending(true);
    setError(null);
    try {
      if (!isConnected) throw new Error("Connect a wallet first.");
      // A wallet parked on another network would otherwise send the tx there,
      // where this contract does not exist.
      if (chainId !== monadTestnet.id) {
        await switchChainAsync({ chainId: monadTestnet.id });
      }
      return await fn();
    } catch (e) {
      const err = e instanceof Error ? e : new Error("Action failed");
      setError(err);
      throw err;
    } finally {
      setIsPending(false);
    }
  }

  async function send(functionName: string, args: readonly unknown[], value?: bigint) {
    const hash = await writeContractAsync({
      ...base,
      functionName,
      args,
      value,
      chainId: monadTestnet.id,
    });
    return waitForTransactionReceipt(config, { hash });
  }

  return {
    isPending,
    error,
    isConnected,
    createVault: (args: {
      agent: Address;
      dripRate: bigint;
      accrualCap: bigint;
      perTxCap: bigint;
      recipients: Address[];
      deposit: bigint;
    }) =>
      run(async () => {
        const receipt = await send(
          "createVault",
          [
            args.agent,
            args.dripRate,
            args.accrualCap,
            args.perTxCap,
            args.recipients,
          ],
          args.deposit,
        );
        return {
          txHash: receipt.transactionHash,
          vaultId: vaultIdFromReceipt(
            receipt.logs as unknown as { data: Hash; topics: string[] }[],
          ).toString(),
        };
      }),
    deposit: (vaultId: bigint, amount: bigint) =>
      run(async () => {
        const receipt = await send("deposit", [vaultId], amount);
        return { txHash: receipt.transactionHash };
      }),
    freeze: (vaultId: bigint) =>
      run(async () => {
        const receipt = await send("freeze", [vaultId]);
        return { txHash: receipt.transactionHash };
      }),
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
