import test from "node:test";
import assert from "node:assert/strict";
import { addresses, getBoard, getDetail, getTrades, words } from "../src/api";
import { LOG_WINDOW, TRADE_TOPIC } from "../src/config";
import type { Book } from "../src/types";

const token = "0x6ce1defd27bce538d9b3a330f7b1e1a43dedb134";
const vault = "0x6618831839225d1ee4e7ba75da6caa5282b4b71f";
const word = (n: string | number) =>
  (typeof n === "number" ? n.toString(16) : n.replace(/^0x/, "")).padStart(
    64,
    "0",
  );
const respond = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
test("ABI decoder validates length and decodes dynamic address arrays", () => {
  assert.deepEqual(addresses("0x" + word(32) + word(1) + word(token)), [token]);
  assert.deepEqual(addresses("0x" + word(32) + word(0)), []);
  assert.throws(() => words("0x123"));
  assert.throws(() => addresses("0x" + word(32) + word(10)));
});
test("detail normalizes expanded vault responses and rejects mismatched tokens", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    respond({
      book: { token, vault: { address: vault } },
      tokens: {},
      head: { block: 1 },
    }),
  );
  assert.equal((await getDetail(token)).book.vault, vault);
  t.mock.method(globalThis, "fetch", async () =>
    respond({ book: { token: vault, vault } }),
  );
  await assert.rejects(getDetail(token), /requested Book/);
});
test("board requests every phase, follows pagination and combines token metadata", async (t) => {
  const requested: URL[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    const u = new URL(url);
    requested.push(u);
    const second = u.searchParams.get("offset") === "100";
    return respond({
      books: [{ token: second ? vault : token }],
      nextOffset: second ? null : 100,
      tokens: { [second ? vault : token]: { symbol: second ? "B" : "A" } },
      head: { block: 1, timestamp: 1 },
      counts: {},
      indexedBlock: 1,
    });
  });
  const data = await getBoard();
  assert.equal(data.books.length, 2);
  assert.equal(Object.keys(data.tokens).length, 2);
  assert.ok(requested[0].searchParams.get("phase")?.includes("aborted"));
  assert.equal(requested[1].searchParams.get("offset"), "100");
});
test("HTTP errors are recoverable, not converted into empty or fabricated books", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    respond({ error: "not found" }, 404),
  );
  await assert.rejects(getDetail(token), /not found/);
});
test("trade feed decodes the actual event ABI and requests the vault-specific window", async (t) => {
  const incoming = "0x18e674231a58c239dc7daedcffe15ec3a24cff5c";
  const outgoing = "0xdee52f2ab639b6942b0d0f0565400b93b7a0fbe5";
  let query: Record<string, unknown> | undefined;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options: RequestInit) => {
      const r = JSON.parse(options.body as string);
      if (r.method === "eth_getLogs") {
        query = r.params[0];
        return respond({
          result: [
            {
              data:
                "0x" +
                word(1) +
                word(vault) +
                word(incoming) +
                word(outgoing) +
                word(1000) +
                word(2000),
              transactionHash: "0x" + word(123),
              logIndex: "0x1",
              blockNumber: "0x64",
              topics: [TRADE_TOPIC],
            },
          ],
        });
      }
      if (r.method === "eth_getBlockByNumber")
        return respond({ result: { timestamp: "0x3e8" } });
      throw new Error("Unexpected RPC method");
    },
  );
  const data = await getTrades(
    { token, vault, bookId: "33" } as Book,
    LOG_WINDOW + 50,
  );
  assert.equal(data.fromBlock, 51);
  assert.equal(query?.address, vault);
  assert.equal(data.trades[0].tokenIn, incoming);
  assert.equal(data.trades[0].tokenOut, outgoing);
  assert.equal(data.trades[0].amountIn, "1000");
  assert.equal(data.trades[0].amountOut, "2000");
  assert.equal(data.trades[0].timestamp, 1000);
});
