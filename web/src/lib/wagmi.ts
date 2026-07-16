import { http, createConfig } from "wagmi";
import { monadTestnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const RPC_URL =
  process.env.NEXT_PUBLIC_MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";

/**
 * The owner signs from their own wallet, so each vault on-chain belongs to the
 * person who opened it. That is what makes freeze and deposit safe: the
 * contract's onlyOwner check is meaningful again. When every vault shared one
 * server-held owner key, any visitor could freeze any other visitor's vault.
 *
 * The agent still signs server-side from its own key. That is the product, not
 * a shortcut — the agent acts autonomously and the vault is what constrains it.
 *
 * `injected` covers MetaMask and other browser wallets and needs no project id,
 * so there is no extra env var to configure at deploy time.
 */
export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: {
    [monadTestnet.id]: http(RPC_URL),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
