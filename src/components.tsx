import { useState, type ReactNode } from "react";
import { bookName, eth, num, phaseLabel, shortAddress, signed } from "./model";
import type { Book, NavPoint } from "./types";

export function Icon({
  name,
  size = 16,
}: {
  name:
    | "book"
    | "star"
    | "refresh"
    | "search"
    | "arrow"
    | "external"
    | "check"
    | "chevron"
    | "activity"
    | "close";
  size?: number;
}) {
  const paths = {
    book: (
      <>
        <path d="M3 4h7v16H3zM14 4h7v16h-7zM3 8h7m4 0h7M3 16h7m4 0h7" />
      </>
    ),
    star: (
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6 7a7 7 0 0 1 11-2l3 3M4 16l3 3a7 7 0 0 0 11-2" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    external: <path d="M14 4h6v6m0-6L10 14m-1-9H4v15h15v-5" />,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m7 10 5 5 5-5" />,
    activity: <path d="M2 12h5l3-8 4 16 3-8h5" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function PhaseBadge({ phase }: { phase: string }) {
  return (
    <span className={`phase phase-${phase}`}>
      <span className="phase-dot" />
      {phaseLabel(phase)}
    </span>
  );
}
export function PinButton({
  book,
  pin,
  onPin,
}: {
  book: Book;
  pin: string;
  onPin: (token: string) => void;
}) {
  const active = pin.toLowerCase() === book.token.toLowerCase();
  return (
    <button
      className={`icon-button pin-button ${active ? "is-pinned" : ""}`}
      aria-label={`${active ? "Unwatch" : "Watch"} ${bookName(book)}`}
      aria-pressed={active}
      title={
        active
          ? "Remove from watchlist"
          : "Watch this Book (replaces current pin)"
      }
      onClick={() => onPin(active ? "" : book.token)}
    >
      <Icon name="star" />
    </button>
  );
}
export function Address({
  address,
  compact = false,
}: {
  address: string;
  compact?: boolean;
}) {
  return compact ? (
    <span className="mono" title={address}>
      {shortAddress(address)}
    </span>
  ) : (
    <code className="address">{address}</code>
  );
}
export function Metric({
  label,
  children,
  note,
  tone = "",
}: {
  label: string;
  children: ReactNode;
  note: ReactNode;
  tone?: string;
}) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <div className={`metric-value ${tone}`}>{children}</div>
      <span className="metric-note">{note}</span>
    </div>
  );
}
export function ErrorNotice({
  error,
  retry,
  stale = false,
}: {
  error: string;
  retry: () => void;
  stale?: boolean;
}) {
  return (
    <div className="error-notice" role="alert">
      <div>
        <strong>{stale ? "Update unavailable" : "Unable to load data"}</strong>
        <p>
          {error}
          {stale ? " Showing the last successful response." : ""}
        </p>
      </div>
      <button className="button" onClick={retry}>
        Retry
      </button>
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name="book" size={28} />
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function BookMark({ book }: { book: Book }) {
  return (
    <span
      className={`book-mark mark-${Number(book.bookId) % 4}`}
      aria-hidden="true"
    >
      {book.symbol.slice(0, 2)}
    </span>
  );
}
export function Section({
  title,
  aside,
  children,
  className = "",
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
export function NavChart({
  points,
  storageOk,
}: {
  points: NavPoint[];
  storageOk: boolean;
}) {
  const [range, setRange] = useState<"1h" | "24h" | "all">("all");
  const [hover, setHover] = useState<number | null>(null);
  const end = points.at(-1)?.t ?? 0;
  const shown = points.filter(
    (p) => range === "all" || p.t >= end - (range === "1h" ? 3600 : 86400),
  );
  const values = shown.map((p) => p.nav),
    low = Math.min(...values),
    high = Math.max(...values);
  const span = high - low || high * 0.01 || 0.001;
  const min = low - span * 0.18,
    max = high + span * 0.18;
  const x = (i: number) =>
    16 +
    (shown.length <= 1
      ? 0.5
      : (shown[i].t - shown[0].t) / (shown.at(-1)!.t - shown[0].t || 1)) *
      688;
  const y = (n: number) => 24 + ((max - n) / (max - min)) * 162;
  const selected = hover == null ? shown.at(-1) : shown[hover];
  const delta =
    shown.length > 1 && shown[0].nav > 0
      ? (shown.at(-1)!.nav / shown[0].nav - 1) * 100
      : null;
  const date = (t?: number) =>
    t
      ? new Date(t * 1000).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        })
      : "—";
  return (
    <Section
      title="NAV history"
      aside={
        <div className="segmented" aria-label="History range">
          {(["1h", "24h", "all"] as const).map((r) => (
            <button
              key={r}
              aria-pressed={range === r}
              onClick={() => {
                setRange(r);
                setHover(null);
              }}
            >
              {r === "all" ? "All" : r}
            </button>
          ))}
        </div>
      }
    >
      <div className="chart-summary">
        <span className="mono">
          {eth(selected?.nav)} <span className="muted">ETH</span>
        </span>
        <span className={`mono ${signed(delta)}`}>
          {delta == null
            ? "First observation"
            : `${delta >= 0 ? "+" : ""}${num(delta, 2)}% in view`}
        </span>
      </div>
      {shown.length > 0 ? (
        <div className="chart">
          <svg
            viewBox="0 0 720 220"
            role="img"
            aria-label={`NAV history, ${shown.length} local samples. Latest ${eth(shown.at(-1)?.nav)} ETH.`}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const px = ((e.clientX - rect.left) / rect.width) * 720;
              let closest = 0;
              shown.forEach((_, i) => {
                if (Math.abs(x(i) - px) < Math.abs(x(closest) - px))
                  closest = i;
              });
              setHover(closest);
            }}
            onPointerLeave={() => setHover(null)}
          >
            {[0, 1, 2, 3].map((i) => (
              <line
                key={i}
                x1="16"
                x2="704"
                y1={24 + i * 54}
                y2={24 + i * 54}
                className="chart-grid"
              />
            ))}
            {shown.length > 1 && (
              <>
                <path
                  d={`M${x(0)},${y(shown[0].nav)} ${shown.map((p, i) => `L${x(i)},${y(p.nav)}`).join(" ")} L${x(shown.length - 1)},192 L${x(0)},192 Z`}
                  className="chart-area"
                />
                <polyline
                  points={shown.map((p, i) => `${x(i)},${y(p.nav)}`).join(" ")}
                  className="chart-line"
                />
              </>
            )}
            {shown.length === 1 && (
              <text
                x="360"
                y="160"
                textAnchor="middle"
                className="chart-caption"
              >
                History builds while this page is open.
              </text>
            )}
            {selected && (
              <circle
                cx={x(hover ?? shown.length - 1)}
                cy={y(selected.nav)}
                r="4"
                className="chart-point"
              />
            )}
            <text x="16" y="215" className="chart-caption">
              {date(shown[0]?.t)} UTC
            </text>
            <text x="704" y="215" textAnchor="end" className="chart-caption">
              {date(shown.at(-1)?.t)} UTC
            </text>
          </svg>
        </div>
      ) : (
        <div className="chart chart-empty">
          Waiting for a priced NAV observation.
        </div>
      )}
      <div className="panel-foot">
        <span>
          {num(shown.length, 0)} {shown.length === 1 ? "sample" : "samples"} · 1
          minute resolution · This browser only
        </span>
        {!storageOk && (
          <span className="negative">
            Storage unavailable; history may not persist.
          </span>
        )}
      </div>
      {shown.length > 0 && (
        <details className="history-details">
          <summary>View history data</summary>
          <div className="history-list">
            {shown
              .slice(-60)
              .reverse()
              .map((p) => (
                <div key={p.t}>
                  <time dateTime={new Date(p.t * 1000).toISOString()}>
                    {new Date(p.t * 1000).toLocaleString("en-GB", {
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                  <span className="mono">{eth(p.nav)} ETH</span>
                </div>
              ))}
          </div>
          <p className="small muted">
            Latest 60 samples shown. Up to 1,440 samples are stored per Book.
          </p>
        </details>
      )}
    </Section>
  );
}
