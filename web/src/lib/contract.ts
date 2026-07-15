import { getAddress, type Abi, type Address } from "viem";
import abi from "./nannyVaultAbi.json";

export const nannyVaultAbi = abi as Abi;

export const NANNY_VAULT_ADDRESS = getAddress(
  process.env.NEXT_PUBLIC_NANNY_VAULT_ADDRESS ??
    "0x8399F8AfD80646d8e6c8Bc74B2C161C64B70228b",
);

/** Block explorer link prefix for a transaction hash — the "verify on chain" link. */
export const EXPLORER_TX = "https://testnet.monadscan.com/tx/";

/**
 * The demo merchant directory. These are the vendors a user can allowlist when
 * opening a vault. In the real world these would be a merchant's payout address;
 * here they are stable testnet addresses the agent can pay.
 *
 * The Attacker address is NOT a real merchant — it is the destination the
 * injected prompt tries to send money to, so the contract can reject it live.
 */
export type Merchant = { name: string; address: Address; blurb: string };

export const MERCHANTS: Merchant[] = [
  {
    name: "MarketCo",
    address: getAddress("0x40D5560C7a6E38Fcd4dA66b824C5a68f9aA6D8B6"),
    blurb: "Groceries & household",
  },
  {
    name: "KitapCo",
    address: getAddress("0x47308189630dff3e2beBd5D4C8B87c23a97f1098"),
    blurb: "Books & media",
  },
  {
    name: "APIco",
    address: getAddress("0x6E8D06185528A5115070ad3e25Ed18a13458fF80"),
    blurb: "API credits & SaaS",
  },
];

export const ATTACKER_ADDRESS = getAddress(
  "0xBFdC60a2Cf4edb9f0f241c3D40550912013d1C33",
);

/**
 * The demo agent's wallet address. The matching private key lives server-side
 * (AGENT_PRIVATE_KEY in .env.local) and is used by the Playground to sign spends
 * in Step 5. A vault created with this agent is spendable by that agent.
 */
export const AGENT_ADDRESS = getAddress(
  process.env.NEXT_PUBLIC_AGENT_ADDRESS ??
    "0x46b471F32D1C2B537d63635954F41320e2D1Cd29",
);

/** The demo owner wallet address (public; the private key stays server-side). */
export const OWNER_ADDRESS = getAddress(
  process.env.NEXT_PUBLIC_OWNER_ADDRESS ??
    "0x93F7d4dAAcbd68cA21f1B3aE9D21BBB002054736",
);

/** Resolve an address back to a human name for the spend log. */
export function merchantName(address: string): string {
  const hit = MERCHANTS.find(
    (m) => m.address.toLowerCase() === address.toLowerCase(),
  );
  if (hit) return hit.name;
  if (address.toLowerCase() === ATTACKER_ADDRESS.toLowerCase())
    return "Unknown address";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
