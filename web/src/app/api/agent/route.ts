import { google } from "@ai-sdk/google";
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
import { parseAuthMessage } from "@/lib/agentAuth";

export const runtime = "nodejs";

const RPC_URL =
  process.env.NEXT_PUBLIC_MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";
const VAULT = getAddress(
  process.env.NEXT_PUBLIC_NANNY_VAULT_ADDRESS ??
    "0x8399F8AfD80646d8e6c8Bc74B2C161C64B70228b",
);
const MODEL = process.env.AGENT_MODEL || "google/gemini-3-flash";

/**
 * Two ways to reach the model, and the env picks which without a code change.
 *
 * With GOOGLE_GENERATIVE_AI_API_KEY set, calls go straight to Google AI Studio,
 * whose free tier needs no card. Without it, a bare "provider/model" string
 * routes through the Vercel AI Gateway — which is the better long-term home
 * (failover, spend tracking) but will not serve a request until the team has a
 * card on file, free credits included.
 */
function resolveModel() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return MODEL;
  // The gateway wants "google/gemini-x"; the direct provider wants "gemini-x".
  return google(MODEL.replace(/^google\//, ""));
}

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
   * The agent wallet is shared, and the contract only asks `msg.sender ==
   * v.agent` — which holds for every vault this app creates. So the chain will
   * happily let this endpoint spend from ANY vault; it is this check, not the
   * contract, that decides whose instruction the agent is willing to take.
   * Vault ids are sequential and public, so without it the whole thing is open.
   */
  const authFailure = await (async (): Promise<string | null> => {
    const auth = body.auth;
    if (!auth?.message || !auth?.signature || !auth?.address) {
      return "Missing authorization. Sign the agent authorization with the vault owner's wallet.";
    }

    const parsed = parseAuthMessage(String(auth.message));
    if (!parsed) return "Malformed authorization message.";

    // Every field below is read from the SIGNED text, never from the request
    // body — otherwise a caller could sign for their own vault and then swap
    // the id, and the signature would still verify.
    if (parsed.vaultId !== vaultId.toString()) {
      return "Authorization is for a different vault.";
    }
    if (parsed.chainId !== monadTestnet.id) {
      return "Authorization is for a different chain.";
    }
    const now = Date.now();
    if (now > parsed.expiresAt) return "Authorization expired. Sign again.";
    // Small tolerance for a client clock running ahead of the server's.
    if (parsed.issuedAt > now + 120_000) {
      return "Authorization is not valid yet.";
    }

    let signer: Address;
    try {
      signer = getAddress(parsed.owner);
    } catch {
      return "Malformed owner address in authorization.";
    }

    // verifyMessage (not recoverAddress) so smart-contract wallets validating
    // via ERC-1271 work too, not only EOAs.
    const validSig = await publicClient.verifyMessage({
      address: signer,
      message: String(auth.message),
      signature: auth.signature as `0x${string}`,
    });
    if (!validSig) return "Invalid signature.";

    // The signature proves who signed; the chain decides whether they own it.
    const vault = (await publicClient.readContract({
      address: VAULT,
      abi: nannyVaultAbi,
      functionName: "getVault",
      args: [vaultId],
    })) as { owner: Address };

    if (vault.owner.toLowerCase() !== signer.toLowerCase()) {
      return "Signer does not own this vault.";
    }
    return null;
  })();

  if (authFailure) {
    return Response.json({ error: authFailure }, { status: 401 });
  }

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

  // No pre-flight check for gateway credentials on purpose. The gateway accepts
  // either AI_GATEWAY_API_KEY or a Vercel OIDC token — and on a deployment that
  // token arrives as the `x-vercel-oidc-token` request header, not an env var
  // (it is only an env var during builds and after `vercel env pull` locally).
  // So an env check cannot predict whether auth will work: guarding on
  // AI_GATEWAY_API_KEY would reject a perfectly good OIDC deployment. Let the
  // call fail and explain it in the catch, where the outcome is actually known.

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

  // The system prompt goes in `instructions`, not as a system message: the AI
  // SDK defaults `allowSystemInMessages` to false and rejects the whole call
  // with "System messages are not allowed in the prompt or messages fields".
  const messages = [
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
      model: resolveModel(),
      tools: { spend },
      stopWhen: stepCountIs(3),
      instructions: SYSTEM,
      messages,
    });

    return Response.json({
      agentText: result.text,
      attempted,
      outcome,
      model: MODEL,
    });
  } catch (err) {
    let message = err instanceof Error ? err.message : "Agent call failed";
    // The gateway's own auth errors don't say how to fix them, and "no
    // credentials at all" is by far the most likely cause on a fresh checkout.
    if (
      /api[- ]?key|unauthor|authenticat|credential|\b401\b|\b403\b/i.test(message)
    ) {
      message +=
        " — the model call was rejected. Free path: set GOOGLE_GENERATIVE_AI_API_KEY from aistudio.google.com (no card). Gateway path: set AI_GATEWAY_API_KEY, or `vercel link && vercel env pull .env.local` for OIDC — the gateway also needs a card on file before it serves anything.";
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
