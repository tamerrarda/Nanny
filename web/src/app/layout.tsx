import type { Metadata } from "next";
import { Geist, Chakra_Petch, Exo_2 } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const chakra = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin"],
  weight: ["600", "700"],
});

// Carries the hero subtitle only. Exo 2 shares Chakra Petch's technical voice
// but is drawn for reading, so it can hold a full sentence the display face
// would fight. Variable font — the weight range costs one file.
const exo2 = Exo_2({
  variable: "--font-exo",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nanny — your AI agent needs adult supervision",
  description:
    "Give your AI agent an allowance, not your wallet. A watchful vault on Monad that enforces the rules your agent can't be trusted to keep.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${chakra.variable} ${exo2.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
