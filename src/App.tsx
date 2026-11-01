import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  getBoard,
  getChain,
  getDetail,
  getHealth,
  getPrices,
  getTrades,
} from "./api";
import {
  API_URL,
  CHAIN_ID,
  FACTORY,
  LOG_WINDOW,
  POLL_MS,
  RPC_URL,
} from "./config";
import {
  Address,
  BookMark,
  Empty,
  ErrorNotice,
  Icon,
  Metric,
  NavChart,
  PhaseBadge,
  PinButton,
  Section,
} from "./components";
import { useClock, useResource, useRoute } from "./hooks";
import {
  bookName,
  bps,
  duration,
  eth,
  ethPrice,
  isAddress,
  num,
  phaseLabel,
  remaining,
  settlement,
  shortAddress,
  signed,
  sortBooks,
  usd,
  wei,
  type SortKey,
} from "./model";
import { loadHistory, recordPoint, savedPin, savePin } from "./storage";
import {
  PHASES,
  type Book,
  type BoardResponse,
  type ChainSnapshot,
  type NavPoint,
  type TokenInfo,
  type Trade,
} from "./types";

const bookHref = (token: string) => `#/book/${token.toLowerCase()}`;
const time = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-GB", { timeZone: "UTC", hour12: false });
const symbol = (token: string, tokens: Record<string, TokenInfo>) =>
  tokens[token.toLowerCase()]?.symbol || shortAddress(token);

export default function App() {
  const query = useRef(
    new URLSearchParams(location.search).get("book"),
  ).current;
  const [pin, setPin] = useState(() =>
    query && isAddress(query) ? query.toLowerCase() : savedPin(),
  );
  const [notice, setNotice] = useState("");
  const hash = useRoute(),
    now = useClock();
  const route = hash.startsWith("#/book/")
    ? "book"
    : hash === "#/watchlist" || (!hash && query)
      ? "watchlist"
      : "board";
  const board = useResource("board", getBoard, POLL_MS);
  const prices = useResource("prices", getPrices, 60_000);
  const health = useResource("health", getHealth, 60_000);
  const tokens = { ...prices.data?.prices, ...board.data?.tokens };
  const price = ethPrice(
    board.error ? {} : (board.data?.tokens ?? {}),
    prices.error ? undefined : prices.data?.prices,
  );
  const online =
    health.data?.ok &&
    health.data.chainId === CHAIN_ID &&
    !health.data.node?.degraded &&
    !health.error;
  const onPin = (token: string) => {
    const lower = token.toLowerCase();
    setPin(lower);
    const saved = savePin(lower);
    const url = new URL(location.href);
    if (lower) url.searchParams.set("book", lower);
    else url.searchParams.delete("book");
    history.replaceState(null, "", url);
    setNotice(
      lower
        ? `Book pinned to Watchlist.${saved ? "" : " Browser storage is unavailable; keep this URL."}`
        : "Book removed from Watchlist.",
    );
  };
  useEffect(() => {
    if (query && isAddress(query)) savePin(query);
  }, [query]);
  return (
    <>
      <a
        className="skip-link"
        href="#content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("page-title")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href="#/board" aria-label="Book Desk board">
          <span className="brand-mark">
            <Icon name="book" size={22} />
          </span>
          <span>
            Book Desk<span className="brand-sub">Mancer Books terminal</span>
          </span>
        </a>
        <div className="header-utilities">
          <span className={`network ${online ? "positive" : "muted"}`}>
            <span className="status-dot" />
            Robinhood Chain <span className="chain-id">/ 4663</span>
          </span>
          <time className="clock mono" dateTime={new Date(now).toISOString()}>
            {time(now)} <span className="muted">UTC</span>
          </time>
        </div>
      </header>
      <div className="nav-bar">
        <nav aria-label="Main navigation">
          <a
            className={route === "board" ? "active" : ""}
            aria-current={route === "board" ? "page" : undefined}
            href="#/board"
          >
            <Icon name="book" size={14} /> Board
          </a>
          <a
            className={route === "watchlist" ? "active" : ""}
            aria-current={route === "watchlist" ? "page" : undefined}
            href="#/watchlist"
          >
            <Icon name="star" size={14} /> Watchlist
          </a>
        </nav>
        <span className="read-only">
          <Icon name="activity" size={14} />
          Public data · Read only
        </span>
      </div>
      <div className={`notice ${notice ? "has-notice" : ""}`} role="status">
        {notice && (
          <>
            <span>{notice}</span>
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <Icon name="close" />
            </button>
          </>
        )}
      </div>
      <main id="content">
        {route === "board" ? (
          <Board
            data={board.data}
            loading={board.loading}
            error={board.error}
            updated={board.updated}
            refresh={() => {
              board.refresh();
              prices.refresh();
              health.refresh();
            }}
            price={price}
            pin={pin}
            onPin={onPin}
            now={now}
          />
        ) : route === "watchlist" ? (
          <Watchlist
            pin={pin}
            onPin={onPin}
            tokens={tokens}
            price={price}
            now={now}
            initialError={
              query && !isAddress(query)
                ? "The URL contains an invalid Book token address."
                : ""
            }
          />
        ) : (
          <BookPage
            key={hash}
            token={hash.slice("#/book/".length)}
            pin={pin}
            onPin={onPin}
            tokens={tokens}
            price={price}
            now={now}
          />
        )}
      </main>
      <footer className="site-footer">
        <span>
          <span className="footer-brand">Book Desk</span> / Independent Mancer
          Books monitor
        </span>
        <div>
          <a href={API_URL + "/health"} target="_blank" rel="noreferrer">
            Mancer API <Icon name="external" size={12} />
          </a>
          <a href={RPC_URL} target="_blank" rel="noreferrer">
            Robinhood RPC <Icon name="external" size={12} />
          </a>
          <span>Chain 4663</span>
        </div>
      </footer>
      <div className="source-strip">
        <span className={online ? "positive" : "muted"}>
          <span className="status-dot" />
          {health.loading && !health.data
            ? "Checking API"
            : health.error
              ? "API health unavailable"
              : online
                ? "API healthy"
                : "API degraded"}
        </span>
        <span className="mono">
          {health.data?.node
            ? `Block ${num(health.data.node.block, 0)}`
            : "Awaiting chain head"}
        </span>
        <span className="source-price mono">
          {prices.error && price != null ? "ETH (Book API)" : "ETH"}{" "}
          {usd(price)}
        </span>
        <span className="source-poll">Refreshes every 15s while visible</span>
      </div>
    </>
  );
}

function Board({
  data,
  loading,
  error,
  updated,
  refresh,
  price,
  pin,
  onPin,
  now,
}: {
  data?: BoardResponse;
  loading: boolean;
  error: string;
  updated: number;
  refresh: () => void;
  price: number | null;
  pin: string;
  onPin: (s: string) => void;
  now: number;
}) {
  const [search, setSearch] = useState(""),
    [phase, setPhase] = useState("all");
  const [sort, setSort] = useState<SortKey>("nav"),
    [direction, setDirection] = useState<"asc" | "desc">("desc");
  const books = data?.books ?? [];
  const priced = books.filter((b) => b.value && wei(b.value.navWei) != null);
  const total = priced.reduce((sum, b) => sum + (wei(b.value?.navWei) ?? 0), 0);
  const trading = books.filter((b) => b.phase === "trading");
  const returns = books.filter((b) => b.value?.returnBps != null);
  const average = returns.length
    ? returns.reduce((s, b) => s + b.value!.returnBps!, 0) / returns.length
    : null;
  const filtered = books.filter(
    (b) =>
      (phase === "all" || b.phase === phase) &&
      [
        bookName(b),
        b.symbol,
        b.token,
        b.creator,
        ...b.traders.map((t) => t.address),
      ].some((s) => s.toLowerCase().includes(search.trim().toLowerCase())),
  );
  const sorted = sortBooks(filtered, sort, direction, now / 1000);
  const setColumn = (key: SortKey) => {
    if (sort === key) setDirection((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDirection(key === "name" || key === "phase" ? "asc" : "desc");
    }
  };
  const column = (label: string, key: SortKey) => (
    <>
      <button
        className={sort === key ? "sort-active" : ""}
        onClick={() => setColumn(key)}
      >
        {label}
        <span aria-hidden="true">
          {sort === key ? (direction === "desc" ? "↓" : "↑") : "↕"}
        </span>
      </button>
      <span className="mobile-column-name">{label}</span>
    </>
  );
  const counts = (p: string) =>
    p === "all" ? books.length : books.filter((b) => b.phase === p).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1 id="page-title" tabIndex={-1}>
            The Book board<span className="heading-dot">.</span>
          </h1>
          <p>Track Mancer trader vaults on Robinhood Chain.</p>
        </div>
        <div className="refresh-group">
          <span className="small muted">
            {updated
              ? `Updated ${time(updated)} UTC`
              : "Waiting for public data"}
          </span>
          <button
            className="button primary"
            onClick={refresh}
            disabled={loading}
          >
            <Icon name="refresh" />
            {loading ? "Refreshing…" : "Refresh board"}
          </button>
        </div>
      </div>
      <div className="metrics-grid">
        <Metric
          label="Total vault NAV"
          note={
            data
              ? `${priced.length} of ${books.length} Books valued${priced.some((b) => b.value?.partial || b.value?.approx) ? " · Includes estimates" : ""}`
              : "Awaiting data"
          }
        >
          {data ? eth(total) : "—"} <span className="unit">ETH</span>
        </Metric>
        <Metric
          label="NAV in USD"
          note={price == null ? "ETH price unavailable" : `ETH ${usd(price)}`}
        >
          {data && price != null ? usd(total * price) : "—"}
        </Metric>
        <Metric
          label="Books trading"
          note={
            data
              ? `${books.length} Books across all phases`
              : "All phases included"
          }
        >
          {data ? String(trading.length).padStart(2, "0") : "—"}
          <span className="metric-divider"> / </span>
          <span className="muted">{data ? books.length : "—"}</span>
        </Metric>
        <Metric
          label="Mean return"
          note={`Equal weight · ${returns.length} priced returns`}
          tone={signed(average)}
        >
          {bps(average)} <span className="unit">bps</span>
        </Metric>
      </div>
      {error && <ErrorNotice error={error} retry={refresh} stale={!!data} />}
      <div className="board-layout">
        <section className="board-panel" aria-label="Books board">
          <div className="board-toolbar">
            <div className="phase-filters" aria-label="Filter by phase">
              {["all", "trading", "raising"].map((p) => (
                <button
                  key={p}
                  aria-pressed={phase === p}
                  className={phase === p ? "selected" : ""}
                  onClick={() => setPhase(p)}
                >
                  {p === "all" ? "All Books" : phaseLabel(p)}
                  <span className="mono">{counts(p)}</span>
                </button>
              ))}
              <label
                className={`more-phases ${!["all", "trading", "raising"].includes(phase) ? "selected" : ""}`}
              >
                <span className="sr-only">Other phases</span>
                <select
                  value={
                    ["all", "trading", "raising"].includes(phase) ? "" : phase
                  }
                  onChange={(e) => {
                    if (e.target.value) setPhase(e.target.value);
                  }}
                >
                  <option value="">More phases</option>
                  {PHASES.filter(
                    (p) => !["trading", "raising"].includes(p),
                  ).map((p) => (
                    <option key={p} value={p}>
                      {phaseLabel(p)} ({counts(p)})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="search-box">
              <Icon name="search" />
              <span className="sr-only">Search Books, tokens or traders</span>
              <input
                type="search"
                placeholder="Search Books or address"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="table-caption">
            <span role="status">
              {loading && !data
                ? "Loading all Books…"
                : `${sorted.length} ${sorted.length === 1 ? "Book" : "Books"}${phase !== "all" ? ` · ${phaseLabel(phase)}` : ""}`}
            </span>
            <div className="sort-controls">
              <label>
                Sort by{" "}
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                >
                  {Object.entries({
                    nav: "NAV",
                    return: "Return",
                    backing: "Price / backing",
                    time: "Time left",
                    name: "Book name",
                    phase: "Phase",
                    trader: "Trader",
                    trust: "Trust",
                  }).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="icon-button"
                aria-label={`Sort ${direction === "desc" ? "ascending" : "descending"}`}
                onClick={() =>
                  setDirection((d) => (d === "asc" ? "desc" : "asc"))
                }
              >
                {direction === "desc" ? "↓" : "↑"}
              </button>
            </div>
            <span className="desktop-table-note">
              Select a Book to inspect <Icon name="arrow" size={12} />
            </span>
          </div>
          <table className="books-table">
            <caption className="sr-only">
              All Mancer Books. Sort columns to compare vaults. Missing data is
              shown as an em dash.
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  aria-sort={
                    sort === "name"
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {column("Book", "name")}
                </th>
                <th
                  scope="col"
                  aria-sort={
                    sort === "phase"
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {column("Phase", "phase")}
                </th>
                <th
                  scope="col"
                  className="number"
                  aria-sort={
                    sort === "nav"
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {column("NAV / ETH", "nav")}
                </th>
                <th
                  scope="col"
                  className="number"
                  aria-sort={
                    sort === "return"
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {column("Return / bps", "return")}
                </th>
                <th
                  scope="col"
                  className="number"
                  aria-sort={
                    sort === "backing"
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {column("P / backing", "backing")}
                </th>
                <th
                  scope="col"
                  aria-sort={
                    sort === "time"
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {column("Time left", "time")}
                </th>
                <th
                  scope="col"
                  aria-sort={
                    sort === "trader"
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {column("Trader / trust", "trader")}
                </th>
                <th scope="col">
                  <span className="sr-only">Watch</span>
                  <Icon name="star" size={14} />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((b, i) => {
                const nav = wei(b.value?.navWei),
                  ret = b.value?.returnBps,
                  pb = b.value?.priceToBackingBps;
                return (
                  <tr key={b.token}>
                    <td className="book-cell">
                      <a href={bookHref(b.token)} className="book-link">
                        <span className="row-index mono">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <BookMark book={b} />
                        <span className="book-identity">
                          <strong>{bookName(b)}</strong>
                          <span className="mono muted">
                            {b.symbol}{" "}
                            <span className="book-id">/ #{b.bookId}</span>
                          </span>
                        </span>
                      </a>
                    </td>
                    <td className="phase-cell">
                      <PhaseBadge phase={b.phase} />
                    </td>
                    <td className="number nav-cell" data-label="NAV / ETH">
                      <span className="mono">
                        {eth(nav)}
                        {b.value?.partial || b.value?.approx ? " ≈" : ""}
                      </span>
                      <span className="cell-sub mono">
                        {nav != null && price != null
                          ? usd(nav * price)
                          : "Unpriced"}
                      </span>
                    </td>
                    <td
                      className={`number return-cell ${signed(ret)}`}
                      data-label="Return / bps"
                    >
                      <span className="mono">{bps(ret)}</span>
                      <span className="cell-sub mono">
                        {ret == null
                          ? "Not available"
                          : `${ret > 0 ? "+" : ""}${num(ret / 100, 2)}%`}
                      </span>
                    </td>
                    <td
                      className="number backing-cell"
                      data-label="P / backing"
                    >
                      <span className="mono">
                        {pb == null ? "—" : `${num(pb / 10000, 2)}×`}
                      </span>
                      <span
                        className={`cell-sub ${pb == null ? "" : pb < 10000 ? "positive" : pb > 10000 ? "negative" : ""}`}
                      >
                        {pb == null
                          ? "Unpriced"
                          : pb < 10000
                            ? "Discount"
                            : pb > 10000
                              ? "Premium"
                              : "At backing"}
                      </span>
                    </td>
                    <td className="time-cell" data-label="Time left">
                      <span className="mono">
                        {duration(remaining(b, now / 1000))}
                      </span>
                      <span className="cell-sub">
                        {b.phase === "raising"
                          ? "Raise window"
                          : b.phase === "settled" || b.phase === "aborted"
                            ? "Closed"
                            : "To unlock"}
                      </span>
                    </td>
                    <td className="trader-cell" data-label="Trader / trust">
                      <span className="mono" title={b.traders[0]?.address}>
                        {b.traders[0]
                          ? shortAddress(b.traders[0].address)
                          : "—"}
                        {b.traders.length > 1
                          ? ` +${b.traders.length - 1}`
                          : ""}
                      </span>
                      <span
                        className={`trust cell-sub ${b.trust === "trusted" ? "positive" : ""}`}
                      >
                        {b.trust === "trusted" && (
                          <Icon name="check" size={12} />
                        )}
                        {phaseLabel(b.trust || "Unknown")}
                      </span>
                    </td>
                    <td className="pin-cell">
                      <PinButton book={b} pin={pin} onPin={onPin} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!data && loading && (
            <div className="loading-state">
              <Icon name="activity" />
              <span>Reading the Mancer Books board…</span>
              <div className="skeleton-rows" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((n) => (
                  <div key={n} />
                ))}
              </div>
            </div>
          )}
          {data && sorted.length === 0 && (
            <Empty title="No matching Books">
              {search
                ? `No Books match “${search}” in this phase.`
                : `There are no Books in the ${phase === "all" ? "current" : phase} view.`}
              <br />
              Choose another phase or clear your filters.
              <button
                className="button empty-action"
                onClick={() => {
                  setSearch("");
                  setPhase("all");
                }}
              >
                Clear filters
              </button>
            </Empty>
          )}
          {!data && error && (
            <Empty title="The board is offline">
              Check your connection, then retry the public data source.
            </Empty>
          )}
          <div className="table-foot">
            <span>
              {data
                ? `Indexer ${data.indexedBlock == null ? "unavailable" : num(data.indexedBlock, 0)} · Head ${num(data.head.block, 0)}`
                : "Mancer API / Robinhood Chain"}
            </span>
            <span>Values are estimates · ≈ partial or approximate</span>
          </div>
        </section>
        <BoardAside books={books} pin={pin} now={now} />
      </div>
    </>
  );
}

function BoardAside({
  books,
  pin,
  now,
}: {
  books: Book[];
  pin: string;
  now: number;
}) {
  const pinned = books.find((b) => b.token.toLowerCase() === pin);
  const leaders = sortBooks(
    books.filter((b) => b.value?.returnBps != null),
    "return",
    "desc",
    now / 1000,
  ).slice(0, 3);
  return (
    <aside className="board-aside">
      <Section title="Desk watch" aside={<Icon name="star" size={14} />}>
        {pinned ? (
          <div className="watch-preview">
            <div className="mini-book">
              <BookMark book={pinned} />
              <span>
                <strong>{bookName(pinned)}</strong>
                <span className="small mono muted">
                  {pinned.symbol} / #{pinned.bookId}
                </span>
              </span>
            </div>
            <div className="watch-quote">
              <span className="mono">
                {eth(wei(pinned.value?.navWei))}{" "}
                <span className="muted small">ETH</span>
              </span>
              <span className={`mono ${signed(pinned.value?.returnBps)}`}>
                {bps(pinned.value?.returnBps)} bps
              </span>
            </div>
            <a className="button full-width" href="#/watchlist">
              Open Watchlist
              <Icon name="arrow" />
            </a>
          </div>
        ) : (
          <div className="aside-content">
            <p>
              {pin
                ? "A Book is pinned. Open Watchlist to load its details."
                : "Keep one Book in focus."}
            </p>
            <p className="muted small">
              {pin
                ? shortAddress(pin)
                : "Select the star beside any Book to pin it here."}
            </p>
            <a className="text-link" href="#/watchlist">
              {pin ? "Open Watchlist" : "Set a Book address"}
              <Icon name="arrow" size={14} />
            </a>
          </div>
        )}
      </Section>
      <Section
        title="Return leaders"
        aside={<span className="small muted">bps</span>}
      >
        <ol className="leaders">
          {leaders.map((b, i) => (
            <li key={b.token}>
              <a href={bookHref(b.token)}>
                <span className="mono muted">0{i + 1}</span>
                <span>
                  {bookName(b)}
                  <span className="small mono muted">{b.symbol}</span>
                </span>
                <span className={`mono ${signed(b.value?.returnBps)}`}>
                  {bps(b.value?.returnBps)}
                </span>
              </a>
            </li>
          ))}
        </ol>
        {!leaders.length && (
          <p className="aside-content muted">Waiting for valued Books.</p>
        )}
        <div className="panel-foot">
          By reported vault return, before close fees
        </div>
      </Section>
      <Section title="Phase breakdown">
        <div className="phase-breakdown">
          {PHASES.filter((p) => books.some((b) => b.phase === p)).map((p) => {
            const count = books.filter((b) => b.phase === p).length;
            return (
              <div key={p}>
                <div>
                  <span>
                    <span className={`phase-dot phase-dot-${p}`} />
                    {phaseLabel(p)}
                  </span>
                  <span className="mono">{count}</span>
                </div>
                <div className="phase-track">
                  <span
                    style={{
                      width: `${(count / Math.max(books.length, 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Section>
      <Section title="Read the numbers">
        <div className="glossary">
          <details>
            <summary>What is NAV?</summary>
            <p>
              The estimated ETH value of assets in the vault, before settlement
              fees. USD uses the current ETH price.
            </p>
          </details>
          <details>
            <summary>Price / backing</summary>
            <p>
              Market token price divided by estimated backing per token. Below
              1× is a discount; above 1× is a premium.
            </p>
          </details>
          <details>
            <summary>What does trust mean?</summary>
            <p>
              Trust is reported by Mancer. It is separate from returns and does
              not guarantee the vault’s performance.
            </p>
          </details>
          <details>
            <summary>Settlement fees</summary>
            <p>
              A 2% close fee applies to vault NAV. The trader receives 20% of
              positive profit after the close fee and cost basis.
            </p>
          </details>
        </div>
      </Section>
    </aside>
  );
}

function Watchlist({
  pin,
  onPin,
  tokens,
  price,
  now,
  initialError,
}: {
  pin: string;
  onPin: (s: string) => void;
  tokens: Record<string, TokenInfo>;
  price: number | null;
  now: number;
  initialError: string;
}) {
  const [address, setAddress] = useState(pin),
    [error, setError] = useState(initialError);
  useEffect(() => {
    setAddress(pin);
  }, [pin]);
  const input = useRef<HTMLInputElement>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isAddress(address.trim())) {
      setError("Use 0x followed by 40 hexadecimal characters.");
      input.current?.focus();
      return;
    }
    setError("");
    onPin(address.trim());
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1 id="page-title" tabIndex={-1}>
            Watchlist<span className="heading-dot">.</span>
          </h1>
          <p>One pinned Book, saved in this browser and URL.</p>
        </div>
        <a href="#/board" className="button">
          Browse all Books
          <Icon name="arrow" />
        </a>
      </div>
      <form className="watch-form" onSubmit={submit}>
        <label htmlFor="book-address">Book token address</label>
        <div className="address-controls">
          <input
            id="book-address"
            ref={input}
            name="book"
            autoComplete="off"
            spellCheck={false}
            value={address}
            placeholder="0x…"
            onChange={(e) => setAddress(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "address-error" : "address-hint"}
          />
          <button className="button primary" type="submit">
            <Icon name="star" />
            Watch Book
          </button>
          {pin && (
            <button
              className="button"
              type="button"
              onClick={() => {
                onPin("");
                setAddress("");
              }}
            >
              Unpin
            </button>
          )}
        </div>
        <p
          id={error ? "address-error" : "address-hint"}
          className={`small ${error ? "negative" : "muted"}`}
          role={error ? "alert" : undefined}
        >
          {error ||
            "Use a Book token address, not its vault. This replaces the current pin. Share this page to share the selected Book."}
        </p>
      </form>
      {pin ? (
        <BookPage
          key={pin}
          token={pin}
          pin={pin}
          onPin={onPin}
          tokens={tokens}
          price={price}
          now={now}
          watched
        />
      ) : (
        <Empty title="Choose a Book to watch">
          Paste its token address above, or select a star on the board.
          <a className="button empty-action" href="#/board">
            Find a Book
            <Icon name="arrow" />
          </a>
        </Empty>
      )}
    </>
  );
}

function BookPage({
  token,
  pin,
  onPin,
  tokens,
  price,
  now,
  watched = false,
}: {
  token: string;
  pin: string;
  onPin: (s: string) => void;
  tokens: Record<string, TokenInfo>;
  price: number | null;
  now: number;
  watched?: boolean;
}) {
  const detail = useResource(
    `book:${token}`,
    (signal) => getDetail(token, signal),
    POLL_MS,
  );
  const book = detail.data?.book;
  const chain = useResource(
    `chain:${token}`,
    (signal) => getChain(book!, signal),
    30_000,
    !!book,
  );
  const [points, setPoints] = useState<NavPoint[]>(() => loadHistory(token)),
    [storageOk, setStorageOk] = useState(true);
  const focused = useRef(false);
  useEffect(() => {
    if (book && !watched && !focused.current) {
      document.getElementById("page-title")?.focus({ preventScroll: true });
      focused.current = true;
    }
  }, [book, watched]);
  useEffect(() => {
    if (!book?.value || book.value.partial || book.flags?.feedStale) return;
    const nav = wei(book.value.navWei);
    if (nav == null) return;
    const result = recordPoint(token, {
      t: book.value.asOf.timestamp,
      nav,
      block: book.value.asOf.block,
    });
    setPoints(result.points);
    setStorageOk(result.saved);
  }, [detail.updated, book, token]);
  useEffect(() => {
    if (book && !watched) document.title = `${bookName(book)} | Book Desk`;
    return () => {
      document.title = "Book Desk | Mancer Books terminal";
    };
  }, [book, watched]);
  if (!book)
    return (
      <>
        {!watched && (
          <a className="back-link" href="#/board">
            ← Back to board
          </a>
        )}
        {!watched && (
          <h1 id="page-title" tabIndex={-1}>
            Book detail
          </h1>
        )}
        {detail.error ? (
          <ErrorNotice error={detail.error} retry={detail.refresh} />
        ) : (
          <div className="loading-state">Reading Book details from Mancer…</div>
        )}
      </>
    );
  const metadata = { ...tokens, ...detail.data?.tokens },
    currentPrice = ethPrice(detail.data?.tokens ?? tokens) ?? price;
  const nav = wei(book.value?.navWei),
    ret = book.value?.returnBps;
  const timeBook = chain.data
    ? {
        ...book,
        times: {
          ...book.times,
          unlockAt: chain.data.unlockAt || book.times.unlockAt,
        },
      }
    : book;
  return (
    <div className="book-page">
      {!watched && (
        <a className="back-link" href="#/board">
          ← Back to board
        </a>
      )}
      <div className="book-page-heading">
        <div className="book-heading-title">
          <BookMark book={book} />
          <div>
            {watched ? (
              <h2>{bookName(book)}</h2>
            ) : (
              <h1 id="page-title" tabIndex={-1}>
                {bookName(book)}
              </h1>
            )}
            <div className="book-subtitle">
              <span className="mono">
                {book.symbol} / Book #{book.bookId}
              </span>
              <PhaseBadge phase={book.phase} />
            </div>
          </div>
        </div>
        <div className="book-heading-actions">
          <PinButton book={book} pin={pin} onPin={onPin} />
          <button
            className="button"
            onClick={() => {
              detail.refresh();
              chain.refresh();
            }}
            disabled={detail.loading}
          >
            <Icon name="refresh" />
            {detail.loading ? "Refreshing…" : "Refresh Book"}
          </button>
        </div>
      </div>
      {book.profile?.description && (
        <p className="book-description">{book.profile.description}</p>
      )}
      <div className="book-address">
        <span className="muted">Token</span>
        <Address address={book.token} />
      </div>
      {detail.error && (
        <ErrorNotice error={detail.error} retry={detail.refresh} stale />
      )}
      {(book.value?.partial || book.value?.approx || book.flags?.feedStale) && (
        <p className="data-warning">
          {book.flags?.feedStale ? "The price feed is stale. " : ""}
          {book.value?.partial ? "Some holdings could not be valued. " : ""}
          {book.value?.approx ? "NAV is approximate. " : ""}Treat these values
          as estimates.
        </p>
      )}
      <div className="metrics-grid">
        <Metric
          label="Vault NAV"
          note={
            nav != null && currentPrice != null
              ? usd(nav * currentPrice)
              : "Not currently valued"
          }
        >
          {eth(nav)} <span className="unit">ETH</span>
        </Metric>
        <Metric
          label="Vault return"
          tone={signed(ret)}
          note={
            book.value?.afterFeesBps != null
              ? `${bps(book.value.afterFeesBps)} bps after fees`
              : "Return unavailable"
          }
        >
          {bps(ret)} <span className="unit">bps</span>
        </Metric>
        <Metric
          label="Price / backing"
          note={
            book.value?.priceToBackingBps != null
              ? book.value.priceToBackingBps < 10000
                ? "Trading below backing"
                : "Trading at or above backing"
              : "Market or backing unavailable"
          }
        >
          {book.value?.priceToBackingBps == null
            ? "—"
            : `${num(book.value.priceToBackingBps / 10000, 3)}×`}
        </Metric>
        <Metric
          label={
            book.phase === "raising" ? "Raise window left" : "Time to unlock"
          }
          note={
            timeBook.times.unlockAt
              ? new Date(timeBook.times.unlockAt * 1000).toLocaleDateString(
                  "en-GB",
                  {
                    timeZone: "UTC",
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  },
                ) + " UTC"
              : phaseLabel(book.phase)
          }
        >
          {duration(remaining(timeBook, now / 1000))}
        </Metric>
      </div>
      <div className="detail-grid">
        <div className="detail-main">
          <NavChart points={points} storageOk={storageOk} />
          <Holdings book={book} tokens={metadata} chain={chain.data} />
          <TradeFeed
            book={book}
            tokens={metadata}
            chain={chain.data}
            chainError={chain.error}
          />
        </div>
        <aside className="detail-aside">
          <Settlement book={book} chain={chain.data} />
          <Section
            title="Trader & trust"
            aside={
              <span
                className={
                  book.trust === "trusted" ? "positive small" : "small"
                }
              >
                {phaseLabel(book.trust)}
              </span>
            }
          >
            <div className="traders">
              {book.traders.map((t) => (
                <div key={t.address}>
                  <div>
                    <Address address={t.address} />
                    <span
                      className={`small ${t.verified ? "positive" : "muted"}`}
                    >
                      {t.verified ? "✓ Verified by Mancer" : "Unverified"}
                    </span>
                    {t.ethos && (
                      <span className="small muted">
                        Ethos {t.ethos.score} · {t.ethos.level}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {!book.traders.length && (
                <p className="muted">No traders reported.</p>
              )}
            </div>
            <div className="panel-foot">
              Trust is a source label, not a return guarantee.
            </div>
          </Section>
          <ChainPanel
            book={book}
            data={chain.data}
            error={chain.error}
            loading={chain.loading}
            refresh={chain.refresh}
          />
          <Targets book={book} tokens={metadata} />
        </aside>
      </div>
      <div className="detail-source">
        <span>
          NAV as of{" "}
          {book.value
            ? `${time(book.value.asOf.timestamp * 1000)} UTC · Block ${num(book.value.asOf.block, 0)}`
            : "unavailable"}{" "}
        </span>
        <span>
          Latest API response {time(detail.updated)} UTC · 15s polling
        </span>
      </div>
    </div>
  );
}

function Holdings({
  book,
  tokens,
  chain,
}: {
  book: Book;
  tokens: Record<string, TokenInfo>;
  chain?: ChainSnapshot;
}) {
  const holdings = [...book.holdings.tokens].sort(
    (a, b) => b.shareBps - a.shareBps,
  );
  const tracked = Object.keys(chain?.balances ?? {}).filter(
    (a) => !holdings.some((h) => h.token.toLowerCase() === a),
  );
  const amount = (address: string) => {
    const raw = chain?.balances[address.toLowerCase()],
      decimals = tokens[address.toLowerCase()]?.decimals;
    if (raw == null || decimals == null) return "—";
    const n = Number(raw) / 10 ** decimals;
    return n > 0 && n < 0.0001 ? n.toExponential(3) : num(n, n < 1 ? 6 : 2);
  };
  return (
    <Section
      title="Vault holdings"
      aside={<span className="small muted">{holdings.length} assets</span>}
    >
      <div className="allocation-bar" aria-hidden="true">
        {holdings
          .filter((h) => h.shareBps > 0)
          .map((h, i) => (
            <span
              key={h.token}
              className={`allocation-${i % 4}`}
              style={{ flex: h.shareBps }}
            />
          ))}
      </div>
      <table className="holdings-table">
        <thead>
          <tr>
            <th scope="col">Asset</th>
            <th scope="col" className="number">
              Tracked balance
            </th>
            <th scope="col" className="number">
              Value / ETH
            </th>
            <th scope="col" className="number">
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, i) => (
            <tr key={h.token}>
              <td>
                <span className="holding-symbol">
                  <span className={`allocation-dot allocation-${i % 4}`} />
                  <strong className="mono">{symbol(h.token, tokens)}</strong>
                </span>
                <details className="inline-address">
                  <summary>Token address</summary>
                  <Address address={h.token} />
                </details>
              </td>
              <td className="number mono" data-label="Tracked">
                {amount(h.token)}
              </td>
              <td className="number mono" data-label="Value / ETH">
                {eth(wei(h.valueWei))}
              </td>
              <td className="number mono" data-label="Share">
                {num(h.shareBps / 100, 2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!holdings.length && (
        <p className="aside-content muted">
          No holdings reported in this phase.
        </p>
      )}
      {tracked.length > 0 && (
        <details className="extra-tracked">
          <summary>
            {tracked.length} additional tracked{" "}
            {tracked.length === 1 ? "token" : "tokens"}
          </summary>
          {tracked.map((a) => (
            <div key={a}>
              <span className="mono">
                {symbol(a, tokens)} · {amount(a)}
              </span>
              <Address address={a} />
            </div>
          ))}
        </details>
      )}
      <div className="panel-foot">
        Shares and valuations: Mancer API. Balances:{" "}
        {chain ? `RPC block ${num(chain.block, 0)}` : "awaiting RPC check"}.
      </div>
    </Section>
  );
}

function Settlement({ book, chain }: { book: Book; chain?: ChainSnapshot }) {
  const cost =
    chain?.costBasisWei ??
    book.costBasisWei ??
    book.settlement?.estimate?.costBasisWei;
  const [input, setInput] = useState("");
  const math =
    book.value && cost != null
      ? settlement(
          book.value.navWei,
          cost,
          book.value.lpPotWei,
          book.value.owedLpFeesWei,
        )
      : null;
  const circulating = book.value ? BigInt(book.value.circulating) : 0n;
  const units = input.trim() ? Number(input) : null;
  const invalid =
    input.trim() !== "" &&
    (units == null || !Number.isFinite(units) || units < 0);
  const exceedsSupply =
    units != null &&
    circulating > 0n &&
    units > Number(circulating) / 10 ** book.decimals;
  const perToken =
    math && circulating > 0n
      ? ((Number(math.holder) / Number(circulating)) * 10 ** book.decimals) /
        1e18
      : null;
  const estimate =
    units != null && !invalid && !exceedsSupply && perToken != null
      ? units * perToken
      : null;
  return (
    <Section
      title="Settlement estimate"
      aside={<span className="small muted">ETH</span>}
    >
      {math ? (
        <>
          <dl className="settlement-lines">
            {[
              ["Vault NAV", math.nav, ""],
              ["Close fee · 2%", -math.close, "negative"],
              ["Cost basis", math.basis, "muted"],
              ["Profit after close fee", math.profit, ""],
              ["Trader cut · 20% of profit", -math.cut, "negative"],
              ["LP pot, including fees", math.liquidity, ""],
            ].map(([label, value, tone]) => (
              <div key={String(label)}>
                <dt>{String(label)}</dt>
                <dd className={`mono ${tone}`}>
                  {BigInt(value) < 0 ? "−" : ""}
                  {eth(wei(String(value).replace("-", "")))}
                </dd>
              </div>
            ))}
            <div className="settlement-total">
              <dt>Estimated holder pot</dt>
              <dd className="mono">{eth(wei(math.holder.toString()))}</dd>
            </div>
          </dl>
          <div className="payout-calculator">
            <label htmlFor="token-amount">Estimate for Book tokens</label>
            <input
              id="token-amount"
              inputMode="decimal"
              autoComplete="off"
              type="number"
              min="0"
              step="any"
              value={input}
              placeholder="Enter token amount"
              onChange={(e) => setInput(e.target.value)}
              aria-describedby="payout-result"
              aria-invalid={invalid || exceedsSupply}
            />
            <p
              id="payout-result"
              className={
                invalid || exceedsSupply ? "negative small" : "small muted"
              }
              role="status"
            >
              {invalid ? (
                "Enter a positive token amount or zero."
              ) : exceedsSupply ? (
                "This amount exceeds the circulating Book supply."
              ) : estimate == null ? (
                perToken == null ? (
                  "Circulating supply is unavailable."
                ) : (
                  "Enter an amount to estimate its share."
                )
              ) : (
                <>
                  Estimated payout{" "}
                  <strong className="mono">{eth(estimate)} ETH</strong>
                </>
              )}
            </p>
          </div>
          <div className="panel-foot">
            2% of NAV, then 20% of positive profit above cost basis. The LP pot
            includes {eth(wei(math.fees.toString()))} ETH of uncollected fees.
            Estimates exclude execution slippage.
          </div>
        </>
      ) : (
        <p className="aside-content muted">
          Settlement needs a valued NAV and cost basis. These are not available
          yet for this Book.
        </p>
      )}
      {book.settlement?.liquidated && (
        <p className="aside-content data-warning">
          This Book has settled. These are reference estimates; consult the
          final settlement on Mancer.
        </p>
      )}
    </Section>
  );
}

function ChainPanel({
  book,
  data,
  error,
  loading,
  refresh,
}: {
  book: Book;
  data?: ChainSnapshot;
  error: string;
  loading: boolean;
  refresh: () => void;
}) {
  return (
    <Section
      title="On-chain check"
      aside={
        <button
          className="icon-button"
          aria-label="Refresh on-chain check"
          onClick={refresh}
          disabled={loading}
        >
          <Icon name="refresh" />
        </button>
      }
    >
      <div className="chain-check">
        <p className={error ? "negative" : data ? "positive" : "muted"}>
          {error
            ? "RPC check unavailable"
            : data
              ? `✓ Factory record confirmed · #${data.bookId}`
              : "Reading factory & vault…"}
        </p>
        {error && <p className="small muted">{error}</p>}
        {data && (
          <>
            <dl>
              <div>
                <dt>Read at block</dt>
                <dd className="mono">{num(data.block, 0)}</dd>
              </div>
              <div>
                <dt>Tracked tokens</dt>
                <dd className="mono">{Object.keys(data.balances).length}</dd>
              </div>
              <div>
                <dt>Registered traders</dt>
                <dd className="mono">{data.traders.length}</dd>
              </div>
            </dl>
            {data.errors.length > 0 && (
              <p className="negative small">
                {data.errors.length} tracked balances unavailable. Retry this
                check.
              </p>
            )}
            {data.vault.toLowerCase() !== book.vault.toLowerCase() && (
              <p className="negative small">
                API vault differs from the factory. Balances and trades use the
                factory vault.
              </p>
            )}
            <details>
              <summary>Registered trader addresses</summary>
              {data.traders.map((a) => (
                <Address key={a} address={a} />
              ))}
            </details>
          </>
        )}
        <details>
          <summary>Contract addresses</summary>
          <p className="small muted">Books factory · Chain 4663</p>
          <Address address={FACTORY} />
          <p className="small muted">
            {data ? "Factory-confirmed vault" : "API-reported vault"}
          </p>
          <Address address={data?.vault ?? book.vault} />
        </details>
      </div>
    </Section>
  );
}

function Targets({
  book,
  tokens,
}: {
  book: Book;
  tokens: Record<string, TokenInfo>;
}) {
  const targets = book.profile?.targets ?? [];
  return (
    <Section
      title="Target tokens"
      aside={<span className="mono small muted">{targets.length} / 16</span>}
    >
      <p className="target-note small muted">
        Trader’s target list. Targets are not holdings.
      </p>
      <ol className="targets-list">
        {targets.map((a, i) => (
          <li key={a}>
            <span className="mono muted">{String(i + 1).padStart(2, "0")}</span>
            <details>
              <summary>
                <span className="mono">{symbol(a, tokens)}</span>
                {tokens[a]?.isStock && (
                  <span className="muted small">Stock</span>
                )}
              </summary>
              <Address address={a} />
            </details>
          </li>
        ))}
      </ol>
      {targets.length < 16 && (
        <div className="panel-foot">
          {16 - targets.length} of 16 target slots are unset by this trader.
        </div>
      )}
    </Section>
  );
}

function TradeFeed({
  book,
  tokens,
  chain,
  chainError,
}: {
  book: Book;
  tokens: Record<string, TokenInfo>;
  chain?: ChainSnapshot;
  chainError: string;
}) {
  const verified = chain
    ? { ...book, vault: chain.vault, bookId: chain.bookId }
    : book;
  const recent = useResource(
    `trades:${book.token}`,
    (signal) => getTrades(verified, undefined, signal),
    30_000,
    !!chain,
  );
  const [earlier, setEarlier] = useState<Trade[]>([]),
    [before, setBefore] = useState<number | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [windows, setWindows] = useState(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const trades = [
    ...new Map(
      [...(recent.data?.trades ?? []), ...earlier].map((t) => [
        `${t.transactionHash}:${t.logIndex}`,
        t,
      ]),
    ).values(),
  ].sort((a, b) => b.block - a.block || b.logIndex - a.logIndex);
  const loadEarlier = async () => {
    const to = (before ?? recent.data?.fromBlock ?? 0) - 1;
    if (to < 0 || pending) return;
    setPending(true);
    setError("");
    controller.current = new AbortController();
    try {
      const p = await getTrades(verified, to, controller.current.signal);
      setEarlier((t) => [...t, ...p.trades]);
      setBefore(p.fromBlock);
      setWindows((n) => n + 1);
    } catch (e) {
      if (!controller.current.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "Earlier trades could not be loaded. Retry.",
        );
    } finally {
      setPending(false);
    }
  };
  const amount = (raw: string, address: string) => {
    const decimals = tokens[address.toLowerCase()]?.decimals;
    if (decimals == null) return `${raw} base units`;
    const n = Number(raw) / 10 ** decimals;
    return n > 0 && n < 0.001 ? n.toExponential(3) : num(n, 4);
  };
  return (
    <Section
      title="Trade feed"
      aside={<span className="small muted">Vault events · 30s</span>}
    >
      {!chain && (
        <p className="aside-content muted">
          {chainError
            ? "Trade events need an on-chain check. Retry the check to load trades."
            : "Verifying the vault before reading trade events…"}
        </p>
      )}
      {recent.error && (
        <ErrorNotice
          error={recent.error}
          retry={recent.refresh}
          stale={!!recent.data}
        />
      )}
      {chain && !recent.data && recent.loading && (
        <p className="aside-content muted">
          Reading the latest {num(LOG_WINDOW, 0)} blocks…
        </p>
      )}
      {recent.data && (
        <>
          <div className="trade-list">
            {trades.map((t) => (
              <div
                className="trade-row"
                key={`${t.transactionHash}:${t.logIndex}`}
              >
                <span className="trade-arrow">
                  <Icon name="arrow" />
                </span>
                <div className="trade-assets">
                  <strong className="mono">
                    {symbol(t.tokenIn, tokens)} → {symbol(t.tokenOut, tokens)}
                  </strong>
                  <span className="small mono muted">
                    {amount(t.amountIn, t.tokenIn)} →{" "}
                    {amount(t.amountOut, t.tokenOut)}
                  </span>
                </div>
                <div className="trade-time">
                  <span className="small mono">
                    {t.timestamp
                      ? time(t.timestamp * 1000) + " UTC"
                      : `Block ${num(t.block, 0)}`}
                  </span>
                  <details>
                    <summary className="small">Transaction</summary>
                    <Address address={t.transactionHash} />
                    <span className="small muted">Block {num(t.block, 0)}</span>
                  </details>
                </div>
              </div>
            ))}
          </div>
          {trades.length === 0 && (
            <div className="feed-empty">
              <Icon name="activity" size={24} />
              <p>No trades in the scanned blocks.</p>
              <span className="small muted">
                Scan earlier blocks to look for previous activity.
              </span>
            </div>
          )}
          <div className="trade-load">
            <span className="small muted">
              {num(LOG_WINDOW, 0)}-block windows · Latest scan{" "}
              {num(recent.data.fromBlock, 0)}–{num(recent.data.toBlock, 0)}
              {windows ? ` · ${windows} earlier windows scanned` : ""}
            </span>
            <button
              className="button"
              disabled={pending || before === 0}
              onClick={() => void loadEarlier()}
            >
              {pending
                ? "Scanning…"
                : before === 0
                  ? "Reached first block"
                  : "Scan earlier blocks"}
              <Icon name="arrow" />
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="negative aside-content" role="alert">
          {error} Use “Scan earlier blocks” to retry.
        </p>
      )}
      <div className="panel-foot">
        Only executed trades emitted by this vault. This is a block-window feed,
        not a complete trading history.
      </div>
    </Section>
  );
}
