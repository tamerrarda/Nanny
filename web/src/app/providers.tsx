"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {/* `reducedMotion="user"` drops transform animations for anyone who has
            asked for less motion, while leaving opacity fades intact. Doing it
            here rather than branching on useReducedMotion in each component
            keeps the server and client markup identical — the hook always
            reports false during SSR, so branching on it desyncs hydration. */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
