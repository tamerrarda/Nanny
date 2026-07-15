import { formatEther, parseEther } from "viem";

/**
 * The UI speaks human: "50 MON per day". The contract speaks wei-per-second.
 * These helpers translate between the two so the words "wei", "gas" and "per
 * second" never reach the screen.
 */

const SECONDS_PER_HOUR = 3_600n;

/**
 * The allowance is framed per hour. Per day is the more natural real-world
 * framing, but on a live testnet demo a daily rate accrues too slowly to show a
 * spend within a minute — per hour keeps the numbers sane and the demo snappy.
 */
export function hourlyMonToDripRate(hourlyMon: string): bigint {
  const perHourWei = parseEther(hourlyMon || "0");
  return perHourWei / SECONDS_PER_HOUR;
}

/**
 * dripRate (wei/sec) -> MON per hour, cleaned for display. The stored rate is a
 * truncated wei/sec value, so reconstructing the hourly figure yields noise like
 * 59.99999…976; round to at most 2 decimals and trim.
 */
export function dripRateToHourlyMon(dripRate: bigint): string {
  const hourly = Number(formatEther(dripRate * SECONDS_PER_HOUR));
  return parseFloat(hourly.toFixed(2)).toString();
}

/** "30" (MON) -> wei. */
export function monToWei(mon: string): bigint {
  return parseEther(mon || "0");
}

/** wei -> "30" (MON), trimmed for display. */
export function weiToMon(wei: bigint, maxDecimals = 4): string {
  const full = formatEther(wei);
  const [whole, frac = ""] = full.split(".");
  if (!frac) return whole;
  const trimmed = frac.slice(0, maxDecimals).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

/**
 * Client-side mirror of the contract's lazy accrual, so the allowance counter
 * can tick every second without polling the chain. Must match NannyVault._settle:
 *   accrued = min(accrued + elapsed * dripRate, accrualCap), then clamp to balance.
 */
export function projectedAllowance(params: {
  accrued: bigint;
  dripRate: bigint;
  accrualCap: bigint;
  lastUpdate: bigint;
  balance: bigint;
  frozen: boolean;
  nowSeconds: bigint;
}): bigint {
  const { accrued, dripRate, accrualCap, lastUpdate, balance, frozen, nowSeconds } =
    params;
  if (frozen) return 0n;
  const elapsed = nowSeconds > lastUpdate ? nowSeconds - lastUpdate : 0n;
  let grown = accrued + elapsed * dripRate;
  if (grown > accrualCap) grown = accrualCap;
  return grown > balance ? balance : grown;
}
