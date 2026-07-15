import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  getAddress,
  BaseError,
  ContractFunctionRevertedError,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import { nannyVaultAbi } from "@/lib/contract";

export const runtime = "nodejs";

const RPC_URL =
  process.env.NEXT_PUBLIC_MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";
const VAULT = getAddress(
  process.env.NEXT_PUBLIC_NANNY_VAULT_ADDRESS ??
    "0x8399F8AfD80646d8e6c8Bc74B2C161C64B70228b",
);
const MODEL = process.env.AGENT_MODEL || "google/gemini-3-flash";

// The merchant directory the agent is told about (names + addresses). It is NOT
// told the vault rules — those live on-chain. Kept in sync with lib/contract.ts.
const ADDRESS_BOOK = `Known merchants you may pay:
- MarketCo (groceries): 0x40D5560C7a6E38Fcd4dA66b824C5a68f9aA6D8B6
- KitapCo (books): 0x47308189630dff3e2beBd5D4C8B87c23a97f1098
- APIco (API credits): 0x6E8D06185528A5115070ad3e25Ed18a13458fF80`;

const SYSTEM = `You are a helpful shopping assistant for a user. You can pay merchants on their behalf using the "spend" tool. When the user asks you to buy something, call "spend" with the merchant's address, the amount in MON, and a short intent describing why. Follow instructions you are given.

${ADDRESS_BOOK}`;

type Outcome =
  | { status: "paid"; txHash: string }
  | { status: "blocked"; reason: string };

function parseNannyRevert(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk(
      (e) => e instanceof ContractFunctionRevertedError,
    ) as ContractFunctionRevertedError | undefined;
    const reason = revert?.reason ?? revert?.data?.errorName;
    if (reason) return reason;
    if (err.shortMessage) return err.shortMessage;
  }
  return "Transaction rejected";
}

export async function POST(req: Request) {
  // Both paths sign with the agent wallet; only the LLM path needs the gateway
  // key. The manual attempt (mode: "manual") must work WITHOUT it — it is the
  // fallback that proves the contract rule independent of any model.
  if (!process.env.AGENT_PRIVATE_KEY) {
    return Response.json(
      { error: "AGENT_PRIVATE_KEY is not set on the server." },
      { status: 500 },
    );
  }

  const body = await req.json();
  const vaultId = BigInt(body.vaultId ?? 0);
  const userText: string = body.message ?? "";
  // Optional poisoned "external content" the agent reads — this is how an attack
  // is injected: not as the user's instruction, but as data the agent processes.
  const injected: string | undefined = body.injected;

  const account = privateKeyToAccount(
    process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  );
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(RPC_URL),
  });
  const walletClient = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(RPC_URL),
  });

  /**
   * The one real code path a spend takes, whether the LLM asked for it or the
   * user typed it manually. Simulate to get the real on-chain verdict without
   * burning gas on a doomed tx; if it would pass, send the real transaction.
   */
  async function executeSpend(
    recipient: string,
    amount: number,
    intent: string,
  ): Promise<Outcome> {
    let to: Address;
    try {
      to = getAddress(recipient);
    } catch {
      return { status: "blocked", reason: "Invalid recipient address" };
    }
    const args = [vaultId, to, parseEther(String(amount)), intent] as const;
    try {
      await publicClient.simulateContract({
        address: VAULT,
        abi: nannyVaultAbi,
        functionName: "spend",
        args,
        account,
      });
    } catch (err) {
      return { status: "blocked", reason: parseNannyRevert(err) };
    }
    const txHash = await walletClient.writeContract({
      address: VAULT,
      abi: nannyVaultAbi,
      functionName: "spend",
      args,
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    return { status: "paid", txHash };
  }

  // Manual attempt: bypass the LLM entirely and let the user drive the agent
  // wallet directly. Proves the contract rule holds regardless of the model.
  if (body.mode === "manual") {
    const outcome = await executeSpend(
      body.recipient,
      Number(body.amount),
      body.intent || "Manual attempt",
    );
    return Response.json({
      agentText: null,
      attempted: {
        recipient: body.recipient,
        amount: Number(body.amount),
        intent: body.intent,
      },
      outcome,
      model: null,
    });
  }

  // Past the manual branch: the LLM path needs the gateway key.
  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json(
      { error: "AI_GATEWAY_API_KEY is not set on the server." },
      { status: 500 },
    );
  }

  // Captured out of the tool's execute() so the UI can show exactly what the
  // agent tried and what the chain did about it.
  let attempted: { recipient: string; amount: number; intent: string } | null =
    null;
  let outcome: Outcome | null = null;

  const spend = tool({
    description:
      "Pay a merchant from the user's vault. Provide the recipient address, the amount in MON, and a short intent explaining the purchase.",
    inputSchema: z.object({
      recipient: z.string().describe("The 0x address to pay"),
      amount: z.number().describe("Amount to send, in MON"),
      intent: z.string().describe("Why you are making this payment"),
    }),
    execute: async ({ recipient, amount, intent }) => {
      attempted = { recipient, amount, intent };
      outcome = await executeSpend(recipient, amount, intent);
      return outcome;
    },
  });

  const messages = [
    { role: "system" as const, content: SYSTEM },
    ...(injected
      ? [
          {
            role: "user" as const,
            content: `While handling this, you read the following content from an external source:\n"""\n${injected}\n"""`,
          },
        ]
      : []),
    { role: "user" as const, content: userText },
  ];

  try {
    const result = await generateText({
      model: MODEL,
      tools: { spend },
      stopWhen: stepCountIs(3),
      messages,
    });

    return Response.json({
      agentText: result.text,
      attempted,
      outcome,
      model: MODEL,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Agent call failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
