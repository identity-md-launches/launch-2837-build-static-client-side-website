export type Phase =
  | "waiting"
  | "raising"
  | "graduated"
  | "trading"
  | "frozen"
  | "settled"
  | "aborted";
export const PHASES: Phase[] = [
  "waiting",
  "raising",
  "graduated",
  "trading",
  "frozen",
  "settled",
  "aborted",
];
export interface TokenInfo {
  symbol?: string;
  name?: string;
  decimals?: number;
  priceUsd?: number | null;
  price?: number | null;
  priceConfidence?: string;
  isStock?: boolean;
}
export interface Holding {
  token: string;
  valueWei: string;
  shareBps: number;
  isWeth: boolean;
  isBook: boolean;
}
export interface BookValue {
  navWei: string;
  lpPotWei: string;
  owedLpFeesWei: string;
  holderPotWei: string;
  closeFeeWei: string;
  circulating: string;
  backingPerTokenWei: string;
  returnBps: number | null;
  afterFeesBps: number | null;
  priceToBackingBps: number | null;
  partial: boolean;
  approx: boolean;
  asOf: { block: number; timestamp: number };
}
export interface Book {
  token: string;
  bookId: string;
  vault: string;
  name: string;
  displayName?: string;
  symbol: string;
  decimals: number;
  phase: Phase;
  creator: string;
  creatorVerified: boolean;
  trust: string;
  deployment?: { factory: string };
  traders: {
    address: string;
    verified: boolean;
    acted: boolean;
    ethos?: { score: number; level: string } | null;
  }[];
  traderCount: number;
  durationSecs: number;
  timeLeftSecs: number | null;
  times: {
    openedAt: number;
    deadline: number | null;
    unlockAt: number | null;
    bondedAt: number | null;
    settledAt: number | null;
  };
  profile?: { description: string | null; targets: string[] };
  quote?: { isWeth: boolean; usd8: string; token: string; symbol: string };
  market?: { priceUsd: number | null; marketCapUsd: number | null };
  value: BookValue | null;
  bookValueWei: string;
  costBasisWei?: string;
  holdings: { count: number; tokens: Holding[] };
  rank?: { ranked: boolean; why: string | null };
  flags?: { feedStale: boolean };
  settlement?: {
    liquidated: boolean;
    estimate?: {
      costBasisWei: string;
      creatorCutWei: string;
      profitWei: string;
    } | null;
  };
}
export interface BoardResponse {
  books: Book[];
  counts: Partial<Record<Phase, number>>;
  head: { block: number; timestamp: number };
  indexedBlock: number | null;
  tokens: Record<string, TokenInfo>;
  nextOffset: number | null;
}
export interface DetailResponse {
  book: Book;
  tokens: Record<string, TokenInfo>;
  head: { block: number; timestamp: number };
  indexedBlock: number | null;
}
export interface PricesResponse {
  prices: Record<string, TokenInfo>;
  ageSec: number;
  market?: { open: boolean; phase: string; note: string };
}
export interface Health {
  ok: boolean;
  chainId: number;
  node?: {
    block: number;
    lagBlocks: number;
    lagSec: number;
    degraded: boolean;
    blockTimestamp: string;
  };
}
export interface ChainSnapshot {
  bookId: string;
  token: string;
  vault: string;
  traders: string[];
  costBasisWei: string;
  unlockAt: number;
  balances: Record<string, string | null>;
  block: number;
  timestamp: number;
  errors: string[];
}
export interface Trade {
  transactionHash: string;
  logIndex: number;
  block: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  timestamp: number | null;
}
export interface TradePage {
  trades: Trade[];
  fromBlock: number;
  toBlock: number;
}
export interface NavPoint {
  t: number;
  nav: number;
  block: number;
}
