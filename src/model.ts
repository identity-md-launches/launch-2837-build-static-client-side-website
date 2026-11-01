import type { Book, NavPoint, TokenInfo } from "./types";
import { WETH } from "./config";

export const isAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);
export const shortAddress = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
export const wei = (s?: string | null): number | null =>
  s == null || !/^\d+$/.test(s) || !Number.isFinite(Number(s))
    ? null
    : Number(s) / 1e18;
export const num = (n: number | null | undefined, digits = 2) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : n.toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
export const eth = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n !== 0 && Math.abs(n) < 0.0001
      ? n.toExponential(2)
      : num(n, 4);
export const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${num(n, 2)}`;
export const bps = (n: number | null | undefined) =>
  n == null ? "—" : `${n > 0 ? "+" : ""}${num(n, 0)}`;
export const signed = (n: number | null | undefined) =>
  n == null ? "" : n >= 0 ? "positive" : "negative";
export const phaseLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const bookName = (b: Book) => b.displayName || b.name || b.symbol;
export function ethPrice(
  tokens: Record<string, TokenInfo>,
  prices?: Record<string, TokenInfo>,
): number | null {
  const p = prices?.[WETH]?.price ?? tokens[WETH]?.priceUsd;
  return p != null && p > 0 ? p : null;
}
export function remaining(b: Book, now: number): number | null {
  if (b.phase === "aborted" || b.phase === "settled") return null;
  const end =
    b.times.unlockAt ??
    (b.phase === "raising" || b.phase === "waiting" ? b.times.deadline : null);
  return end == null ? null : Math.max(0, end - now);
}
export function duration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds <= 0) return "Window ended";
  const d = Math.floor(seconds / 86400),
    h = Math.floor((seconds % 86400) / 3600),
    m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${Math.max(1, m)}m`;
}
export type SortKey =
  "name" | "phase" | "nav" | "return" | "backing" | "time" | "trader" | "trust";
export function sortBooks(
  books: Book[],
  key: SortKey,
  dir: "asc" | "desc",
  now: number,
) {
  const value = (b: Book): number | string | null => {
    switch (key) {
      case "name":
        return bookName(b).toLowerCase();
      case "phase":
        return b.phase;
      case "nav":
        return wei(b.value?.navWei);
      case "return":
        return b.value?.returnBps ?? null;
      case "backing":
        return b.value?.priceToBackingBps ?? null;
      case "time":
        return remaining(b, now);
      case "trader":
        return b.traders[0]?.address.toLowerCase() ?? null;
      case "trust":
        return b.trust;
    }
  };
  return [...books].sort((a, b) => {
    const av = value(a),
      bv = value(b);
    if (av == null) return bv == null ? a.token.localeCompare(b.token) : 1;
    if (bv == null) return -1;
    const result =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
    return (dir === "asc" ? result : -result) || a.token.localeCompare(b.token);
  });
}
export function settlement(
  nav: string,
  cost: string,
  lp: string,
  owed: string,
) {
  const n = BigInt(nav),
    basis = BigInt(cost),
    liquidity = BigInt(lp),
    fees = BigInt(owed);
  const close = (n * 200n) / 10000n;
  const profit = n - close > basis ? n - close - basis : 0n;
  const cut = (profit * 2000n) / 10000n;
  return {
    nav: n,
    basis,
    close,
    profit,
    cut,
    liquidity,
    fees,
    // Mancer's lpPotWei already includes owedLpFeesWei; fees is informational.
    holder: n - close - cut + liquidity,
  };
}
export function cleanPoints(value: unknown): NavPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (p): p is NavPoint =>
        p != null &&
        Number.isFinite(p.t) &&
        Number.isFinite(p.nav) &&
        p.nav >= 0 &&
        Number.isInteger(p.block),
    )
    .sort((a, b) => a.t - b.t)
    .slice(-1440);
}
