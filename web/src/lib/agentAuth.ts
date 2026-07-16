import type { Address, Hex } from "viem";

/**
 * Proof that the person driving the agent owns the vault they are driving it on.
 *
 * The agent is one shared, server-held wallet, and the contract only asks
 * `msg.sender == v.agent` — which is true for every vault this app creates. So
 * the chain cannot tell whose instruction it is; without this, anyone could POST
 * someone else's (sequential, public) vaultId and spend from their vault.
 *
 * The owner signs once per vault and the signature travels with each request.
 * It is a bearer token: scoped to one vaultId and short-lived, so a leaked one
 * is replayable only against that vault until it expires. A server-side nonce
 * store would close that too, at the cost of state this demo doesn't have.
 */
export const AUTH_TTL_MS = 30 * 60 * 1000; // 30 minutes

export type AgentAuth = {
  address: Address;
  message: string;
  signature: Hex;
};

export function buildAuthMessage(args: {
  vaultId: string;
  owner: Address;
  chainId: number;
  issuedAt: number;
  expiresAt: number;
}) {
  // Every field the server checks is in the signed text. Anything left out of
  // the message could be swapped by the caller without breaking the signature.
  return [
    "Nanny — authorize the demo agent",
    "",
    `Vault: ${args.vaultId}`,
    `Owner: ${args.owner}`,
    `Chain: ${args.chainId}`,
    `Issued: ${new Date(args.issuedAt).toISOString()}`,
    `Expires: ${new Date(args.expiresAt).toISOString()}`,
    "",
    "Signing lets Nanny's demo agent act on this vault on your behalf until it",
    "expires. It moves no funds by itself — the vault's rules still decide.",
  ].join("\n");
}

export type ParsedAuth = {
  vaultId: string;
  owner: string;
  chainId: number;
  issuedAt: number;
  expiresAt: number;
};

/** Reads the fields back out of a signed message. Returns null if it is not
 *  ours or is malformed — callers must treat that as a failed auth. */
export function parseAuthMessage(message: string): ParsedAuth | null {
  if (!message.startsWith("Nanny — authorize the demo agent")) return null;
  const field = (name: string) =>
    message.match(new RegExp(`^${name}: (.+)$`, "m"))?.[1]?.trim();

  const vaultId = field("Vault");
  const owner = field("Owner");
  const chainId = field("Chain");
  const issued = field("Issued");
  const expires = field("Expires");
  if (!vaultId || !owner || !chainId || !issued || !expires) return null;

  const issuedAt = Date.parse(issued);
  const expiresAt = Date.parse(expires);
  if (Number.isNaN(issuedAt) || Number.isNaN(expiresAt)) return null;
  if (!/^\d+$/.test(vaultId)) return null;

  return {
    vaultId,
    owner,
    chainId: Number(chainId),
    issuedAt,
    expiresAt,
  };
}
