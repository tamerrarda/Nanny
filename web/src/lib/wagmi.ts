import { http, createConfig } from "wagmi";
import { monadTestnet } from "wagmi/chains";

const RPC_URL =
  process.env.NEXT_PUBLIC_MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";

/**
 * Read-only wagmi config: the app signs through server-side wallets (owner +
 * agent), so the client never connects a wallet. wagmi is here purely for the
 * contract reads and the live Spent event feed.
 */
export const wagmiConfig = createConfig({
  chains: [monadTestnet],
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
