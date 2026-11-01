import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanPoints,
  duration,
  ethPrice,
  isAddress,
  remaining,
  settlement,
  sortBooks,
  wei,
} from "../src/model";
import { WETH } from "../src/config";
import type { Book } from "../src/types";

const token = "0x6ce1defd27bce538d9b3a330f7b1e1a43dedb134";
const book = (name: string, nav: string | null): Book => ({
  token,
  bookId: "33",
  name,
  symbol: "CHILL",
  vault: "0x6618831839225d1ee4e7ba75da6caa5282b4b71f",
  creator: "0xbc43a79d1c49e86baea7c90993b79d15fc822d95",
  creatorVerified: true,
  decimals: 18,
  phase: "trading",
  traders: [],
  trust: "trusted",
  traderCount: 1,
  durationSecs: 100,
  timeLeftSecs: 50,
  times: {
    openedAt: 0,
    deadline: null,
    unlockAt: 200,
    bondedAt: 100,
    settledAt: null,
  },
  bookValueWei: "0",
  holdings: { count: 0, tokens: [] },
  value:
    nav == null
      ? null
      : {
          navWei: nav,
          lpPotWei: "0",
          owedLpFeesWei: "0",
          holderPotWei: "0",
          closeFeeWei: "0",
          circulating: "0",
          backingPerTokenWei: "0",
          returnBps: 0,
          afterFeesBps: 0,
          priceToBackingBps: 10000,
          partial: false,
          approx: false,
          asOf: { block: 1, timestamp: 1 },
        },
});
test("settlement exactly matches the observed API estimate for Book #33", () => {
  const s = settlement(
    "2249785793499760402",
    "2153403103988247775",
    "455188352933987493",
    "0",
  );
  assert.equal(s.close, 44995715869995208n);
  assert.equal(s.profit, 51386973641517419n);
  assert.equal(s.cut, 10277394728303483n);
  assert.equal(s.holder, 2649701035835449204n);
});
test("settlement matches Book #30 when uncollected fees are already inside the LP pot", () => {
  const s = settlement(
    "21415050141495359",
    "21189385011306939",
    "22717834431954239",
    "158089574598593",
  );
  assert.equal(s.close, 428301002829907n);
  assert.equal(s.cut, 0n);
  assert.equal(s.fees, 158089574598593n);
  assert.equal(s.holder, 43704583570619691n);
});
test("losses pay no trader cut; close fee applies and the inclusive LP pot is added once", () => {
  const s = settlement("10000", "12000", "3000", "50");
  assert.equal(s.close, 200n);
  assert.equal(s.profit, 0n);
  assert.equal(s.cut, 0n);
  assert.equal(s.holder, 12800n);
});
test("break-even after fee pays no cut and integer rounding is deterministic", () => {
  assert.equal(settlement("10000", "9800", "0", "0").cut, 0n);
  assert.equal(settlement("49", "0", "0", "0").close, 0n);
  assert.equal(settlement("49", "0", "0", "0").holder, 40n);
});
test("NAV sorting puts unavailable values last in both directions and never mutates the board", () => {
  const source = [
    book("Unknown", null),
    book("Large", "3000000000000000000"),
    book("Small", "1000000000000000000"),
  ];
  assert.deepEqual(
    sortBooks(source, "nav", "desc", 150).map((b) => b.name),
    ["Large", "Small", "Unknown"],
  );
  assert.deepEqual(
    sortBooks(source, "nav", "asc", 150).map((b) => b.name),
    ["Small", "Large", "Unknown"],
  );
  assert.equal(source[0].name, "Unknown");
});
test("remaining time uses absolute chain time and respects closed phases", () => {
  const b = book("Book", null);
  assert.equal(remaining(b, 150), 50);
  assert.equal(remaining(b, 250), 0);
  assert.equal(remaining({ ...b, phase: "settled" }, 150), null);
  assert.equal(
    remaining(
      {
        ...b,
        phase: "raising",
        times: { ...b.times, unlockAt: null, deadline: 175 },
      },
      150,
    ),
    25,
  );
  assert.equal(duration(86460), "1d 0h");
  assert.equal(duration(0), "Window ended");
});
test("history rejects corrupt samples, sorts timestamps and bounds storage", () => {
  assert.deepEqual(
    cleanPoints([
      { t: 2, nav: 2, block: 2 },
      { t: 1, nav: 1, block: 1 },
      { t: 3, nav: -1, block: 3 },
      null,
    ]),
    [
      { t: 1, nav: 1, block: 1 },
      { t: 2, nav: 2, block: 2 },
    ],
  );
  assert.equal(
    cleanPoints(
      Array.from({ length: 1600 }, (_, i) => ({ t: i, nav: 1, block: i })),
    ).length,
    1440,
  );
});
test("address and price helpers reject missing and malformed values", () => {
  assert.ok(isAddress(token));
  assert.ok(!isAddress("0x1234"));
  assert.equal(wei(undefined), null);
  assert.equal(wei("no"), null);
  assert.equal(wei("0"), 0);
  assert.equal(ethPrice({ [WETH]: { priceUsd: 2200 } }), 2200);
  assert.equal(ethPrice({}, { [WETH]: { price: 2300 } }), 2300);
  assert.equal(ethPrice({}), null);
});
