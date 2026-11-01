import {
  API_URL,
  CHAIN_ID,
  FACTORY,
  LOG_WINDOW,
  RPC_URL,
  SELECTORS,
  TRADE_TOPIC,
} from "./config";
import { isAddress } from "./model";
import {
  PHASES,
  type BoardResponse,
  type Book,
  type ChainSnapshot,
  type DetailResponse,
  type Health,
  type PricesResponse,
  type Trade,
  type TradePage,
} from "./types";

async function json<T>(url: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(15_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  const r = await fetch(url, { ...options, signal });
  const body = await r.json().catch(() => null);
  if (!r.ok)
    throw new Error(
      r.status === 404
        ? "This Book was not found."
        : r.status === 429
          ? "The data source is busy. Try again shortly."
          : `Data source returned HTTP ${r.status}. Try again.`,
    );
  if (body == null)
    throw new Error(
      "The data source returned an unreadable response. Try again.",
    );
  return body as T;
}
export async function getBoard(signal?: AbortSignal): Promise<BoardResponse> {
  const books = new Map<string, Book>();
  let offset = 0,
    first: BoardResponse | undefined;
  const tokens: BoardResponse["tokens"] = {};
  for (let page = 0; page < 100; page++) {
    const query = new URLSearchParams({
      phase: PHASES.join(","),
      limit: "100",
      offset: String(offset),
    });
    const data = await json<BoardResponse>(`${API_URL}/v1/books?${query}`, {
      signal,
    });
    if (!Array.isArray(data.books) || !data.head)
      throw new Error("The board response has changed. Try again later.");
    first ??= data;
    for (const book of data.books)
      if (isAddress(book.token)) books.set(book.token.toLowerCase(), book);
    Object.assign(tokens, data.tokens);
    if (data.nextOffset == null)
      return { ...first, books: [...books.values()], tokens, nextOffset: null };
    if (data.nextOffset <= offset)
      throw new Error("The board returned an invalid next page. Try again.");
    offset = data.nextOffset;
  }
  throw new Error("The board exceeded its page limit. Try again later.");
}
export async function getDetail(
  token: string,
  signal?: AbortSignal,
): Promise<DetailResponse> {
  if (!isAddress(token))
    throw new Error(
      "Enter a Book token address: 0x followed by 40 hexadecimal characters.",
    );
  const data = await json<
    Omit<DetailResponse, "book"> & {
      book: Omit<Book, "vault"> & { vault: string | { address: string } };
    }
  >(`${API_URL}/v1/books/${token.toLowerCase()}`, { signal });
  if (!data.book || data.book.token.toLowerCase() !== token.toLowerCase())
    throw new Error("The data source did not return the requested Book.");
  // Board summaries use a string; detail responses expand vault into an object.
  const vault =
    typeof data.book.vault === "string"
      ? data.book.vault
      : data.book.vault.address;
  if (!isAddress(vault))
    throw new Error("The Book response did not include a valid vault address.");
  return { ...data, book: { ...data.book, vault } };
}
export const getPrices = (signal?: AbortSignal) =>
  json<PricesResponse>(`${API_URL}/v1/prices`, { signal });
export const getHealth = (signal?: AbortSignal) =>
  json<Health>(`${API_URL}/health`, { signal });

let rpcId = 0;
export async function rpc<T>(
  method: string,
  params: unknown[],
  signal?: AbortSignal,
): Promise<T> {
  const data = await json<{ result?: T; error?: { message: string } }>(
    RPC_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
      signal,
    },
  );
  if (data.error || data.result == null)
    throw new Error(data.error?.message ?? "RPC returned no data.");
  return data.result;
}
const hex = (n: number | bigint) => `0x${n.toString(16)}`;
const arg = (n: string | number | bigint) =>
  (typeof n === "string" && n.startsWith("0x")
    ? n.slice(2)
    : BigInt(n).toString(16)
  ).padStart(64, "0");
export function words(raw: string): string[] {
  if (!/^0x(?:[\da-fA-F]{64})+$/.test(raw))
    throw new Error("The contract returned invalid ABI data.");
  return raw.slice(2).match(/.{64}/g)!;
}
export function addresses(raw: string): string[] {
  const w = words(raw),
    offset = Number(BigInt(`0x${w[0]}`)) / 32;
  const count = Number(BigInt(`0x${w[offset] ?? ""}`));
  if (!Number.isInteger(offset) || count < 0 || count > w.length - offset - 1)
    throw new Error("The contract returned an invalid address list.");
  return w
    .slice(offset + 1, offset + 1 + count)
    .map((a) => `0x${a.slice(-40)}`.toLowerCase());
}
const uint = (raw: string) => BigInt(`0x${words(raw)[0]}`).toString();
const call = (to: string, data: string, block: string, signal?: AbortSignal) =>
  rpc<string>("eth_call", [{ to, data }, block], signal);
export async function getChain(
  book: Book,
  signal?: AbortSignal,
): Promise<ChainSnapshot> {
  const [chain, head] = await Promise.all([
    rpc<string>("eth_chainId", [], signal),
    rpc<{ number: string; timestamp: string }>(
      "eth_getBlockByNumber",
      ["latest", false],
      signal,
    ),
  ]);
  if (Number(BigInt(chain)) !== CHAIN_ID)
    throw new Error(
      "RPC is on the wrong chain. Robinhood Chain (4663) is required.",
    );
  const block = head.number;
  // Resolve the ID from the token itself; do not trust an API-provided ID or vault.
  const id = uint(
    await call(
      FACTORY,
      SELECTORS.bookIdOfToken + arg(book.token),
      block,
      signal,
    ),
  );
  if (id === "0")
    throw new Error("This token is not registered at the Books factory.");
  const tuple = words(
    await call(FACTORY, SELECTORS.bookOf + arg(id), block, signal),
  );
  if (tuple.length < 3)
    throw new Error("Factory returned an incomplete Book record.");
  const token = `0x${tuple[0].slice(-40)}`,
    vault = `0x${tuple[1].slice(-40)}`;
  if (
    token.toLowerCase() !== book.token.toLowerCase() ||
    /^0x0{40}$/.test(vault)
  )
    throw new Error("Factory token verification failed.");
  const results = await Promise.allSettled([
    call(FACTORY, SELECTORS.tradersOf + arg(id), block, signal).then(addresses),
    call(FACTORY, SELECTORS.costBasis + arg(id), block, signal).then(uint),
    call(FACTORY, SELECTORS.unlockAt + arg(id), block, signal).then(uint),
    call(vault, SELECTORS.trackedTokens, block, signal).then(addresses),
  ] as const);
  const [traders, cost, unlock, tracked] = results;
  if (
    traders.status !== "fulfilled" ||
    cost.status !== "fulfilled" ||
    unlock.status !== "fulfilled" ||
    tracked.status !== "fulfilled"
  )
    throw new Error(
      "Some contract reads failed. Retry the on-chain check. API data remains available.",
    );
  const balances: Record<string, string | null> = {},
    errors: string[] = [];
  // Four concurrent calls, including every tracked token, without an RPC batch dependency.
  for (let i = 0; i < tracked.value.length; i += 4) {
    await Promise.all(
      tracked.value.slice(i, i + 4).map(async (address) => {
        try {
          balances[address] = uint(
            await call(
              vault,
              SELECTORS.trackedBalance + arg(address),
              block,
              signal,
            ),
          );
        } catch {
          balances[address] = null;
          errors.push(`Balance unavailable for ${address}`);
        }
      }),
    );
  }
  return {
    bookId: id,
    token,
    vault,
    traders: traders.value,
    costBasisWei: cost.value,
    unlockAt: Number(unlock.value),
    balances,
    block: Number(BigInt(block)),
    timestamp: Number(BigInt(head.timestamp)),
    errors,
  };
}
interface RpcLog {
  data: string;
  topics: string[];
  transactionHash: string;
  blockNumber: string;
  logIndex: string;
  removed?: boolean;
}
export async function getTrades(
  book: Book,
  toBlock?: number,
  signal?: AbortSignal,
): Promise<TradePage> {
  const head =
    toBlock ?? Number(BigInt(await rpc<string>("eth_blockNumber", [], signal)));
  const from = Math.max(0, head - LOG_WINDOW + 1);
  const logs = await rpc<RpcLog[]>(
    "eth_getLogs",
    [
      {
        address: book.vault,
        fromBlock: hex(from),
        toBlock: hex(head),
        topics: [TRADE_TOPIC, `0x${arg(book.bookId)}`],
      },
    ],
    signal,
  );
  const trades: Trade[] = logs
    .filter((l) => !l.removed)
    .map((l) => {
      const w = words(l.data);
      if (w.length !== 6)
        throw new Error("A trade event returned an unexpected format.");
      return {
        transactionHash: l.transactionHash,
        logIndex: Number(BigInt(l.logIndex)),
        block: Number(BigInt(l.blockNumber)),
        tokenIn: `0x${w[2].slice(-40)}`,
        tokenOut: `0x${w[3].slice(-40)}`,
        amountIn: BigInt(`0x${w[4]}`).toString(),
        amountOut: BigInt(`0x${w[5]}`).toString(),
        timestamp: null,
      };
    })
    .sort((a, b) => b.block - a.block || b.logIndex - a.logIndex);
  // Timestamp the latest 30 events; older rows retain a precise block reference.
  const blocks = [...new Set(trades.slice(0, 30).map((t) => t.block))];
  const timestamps = new Map<number, number>();
  for (let i = 0; i < blocks.length; i += 4) {
    await Promise.all(
      blocks.slice(i, i + 4).map(async (n) => {
        try {
          const b = await rpc<{ timestamp: string }>(
            "eth_getBlockByNumber",
            [hex(n), false],
            signal,
          );
          timestamps.set(n, Number(BigInt(b.timestamp)));
        } catch {
          /* Block number remains available. */
        }
      }),
    );
  }
  return {
    trades: trades.map((t) => ({
      ...t,
      timestamp: timestamps.get(t.block) ?? null,
    })),
    fromBlock: from,
    toBlock: head,
  };
}
