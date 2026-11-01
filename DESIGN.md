# Book Desk design system

## Overview

Book Desk is a public-data research terminal for readers comparing Mancer trader vaults. The implemented direction is the brief's dark Bloomberg-style terminal: orange on near-black, dense rows, precise numeric alignment and compact utility controls. The board starts with the comparison task, without a marketing hero. Book detail puts valuation and exposure before the supporting contract and trader data.

The source of truth is `src/style.css`; shared primitives are in `src/components.tsx`, with page composition in `src/App.tsx`. Screenshots and rendered checks are documented in `artifacts/validation.md`. One dark theme is implemented because it is the requested visual direction.

## Colors

The primitive palette and semantic aliases are declared together at `src/style.css:17`. Components consume semantic tokens. All colors are sRGB hex values.

| Semantic token | Primitive / value | Implemented role |
| --- | --- | --- |
| `--bg` | `--neutral-950` / `#0b0c0e` | Page background and inset fields |
| `--surface` | `--neutral-900` / `#101114` | Tables, metric strip, panels, navigation |
| `--hover` | `--neutral-850` / `#15171b` | Hovered rows and table headers |
| `--control` | `--neutral-800` / `#1c1e23` | Neutral button fills and inactive tracks |
| `--border` | `--neutral-700` / `#2c2f36` | Structural dividers and field boundaries |
| `--muted` | `--neutral-500` / `#969aa5` | Secondary labels, timestamps, explanatory copy |
| `--secondary` | `--neutral-300` / `#bfc2ca` | Addresses and supporting data |
| `--text` | `--neutral-100` / `#eeefef` | Main text and figures |
| `--accent`, `--focus` | `--orange-500` / `#ff8a3d` | Brand, primary action, active navigation, selected controls and focus outline |
| `--accent-surface` | `--orange-950` / `#261a12` | Selected controls and raising phase |
| `--positive` | `--green-400` / `#6cdaa6` | Positive returns, trading status and source verification |
| `--positive-surface` | `--green-950` / `#12251d` | Trading badge background |
| `--negative` | `--red-400` / `#ff8888` | Negative returns, deductions and errors |
| `--negative-surface` | `--red-950` / `#2a181b` | Error panels and aborted phase |

Two isolated control values also exist: primary hover `#ffa363`, selected filter border `#694026`; the error boundary uses `#774345`. These are state borders/fills, not text tokens. Orange also identifies chart data and selected allocation segments, as part of the requested terminal visual direction. Status always has text or a sign as well as color.

Five rendered solid pairs were measured in Chromium: primary button text/background **8.344:1**, muted text/panel **6.709:1**, heading/page **16.986:1**, positive return/panel **10.983:1**, negative return/panel **8.207:1**. Full probe coverage and limitations are in the validation report. The focus outline uses the orange token on dark adjacent surfaces; forced-colors mode uses the system `Highlight` color.

## Typography

`--font` is the platform stack `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Its exact rendered family depends on the host. `--mono` is locally bundled **IBM Plex Mono** with a generic monospace fallback. WOFF2 weights 400 and 500 are declared in `src/style.css:1`, with `font-display: swap`; both were observed loaded. No remote font service is used.

| Token | Size at the default 16px root | Use |
| --- | --- | --- |
| `--text-xs` | 12px | Dense table data, timestamps, labels, utility controls |
| `--text-sm` | 13px | Book names, supporting copy and desktop navigation |
| `--text-base` | 14px | Default body and subordinate headings |
| `--text-lg` | 16px | Panel headings and mobile form inputs |
| `--text-xl` | 20px | Brand, compact page headings and narrow metric values |
| `--text-display` | 24px | Wide page headings and metric values |

There are six sizes and three computed weights: 400, 500, 600. Body and table text use weight 400; controls, figures and short labels use 500; page headings and brand use 600 in the system face. Prose is sans-serif. Data, symbols, addresses, balances and times use monospace with tabular figures.

Body line height is 1.5; page headings use 1.25 with `-0.03em` tracking. Other content has natural letter spacing. Descriptions wrap, and long addresses use `overflow-wrap`/`word-break` rather than truncation. Full addresses remain reachable even when a board summary is abbreviated. Mobile inputs use 16px to avoid iOS focus zoom. The 12–14px reading scale is deliberate for the requested dense professional terminal; this is not a long-form article layout.

## Layout

The main content is capped at 1800px, centered, with 32px desktop inline margins and 28px top padding. Header and navigation share those normal-width edges. Common spacing is 4, 8, 12, 16, 20, 24 and 32px. Related label/value pairs have small internal gaps; separate data sections have 20–24px gaps. The header's 3px orange rule and the shared table dividers carry the terminal identity.

The metric strip has four equal columns on wide screens. The board uses a flexible table plus a 272px side column with a 24px gap. Book detail uses a flexible main column plus a 340px side column. Panels always use `min-inline-size: 0`, allowing real content to reflow.

| Breakpoint | Final behavior |
| --- | --- |
| At/below 86rem / 1376px | Board aside becomes 250px with a 20px gap; compact identity spacing |
| At/below 74rem / 1184px | Board aside moves below the table into three columns; glossary spans the row; detail aside is 310px; metric values use 20px |
| At/below 56rem / 896px | Margins become 24px; metrics become 2×2; detail becomes one main column with supporting panels in two columns; UTC header clock is removed |
| At/below 44rem / 704px | Margins become 16px; all board fields reflow into labeled per-Book grids, without a horizontally scrolling table; holdings similarly reflow; side panels stack; address form wraps; inputs use 16px |
| At/below 23rem / 368px | Main margins become 12px; filters use three cells with a full-row phase selector; compact metric text uses 16px |

Mobile rows retain the Book name, phase, NAV in both units, return, price/backing, trader/trust, countdown and pin control. Their visual order is identity, phase/trader, numeric comparison, countdown. Sorting remains available through a labeled select and direction button. Desktop header buttons are removed from mobile focus order while static screen-reader column labels remain. Glossary disclosures remain reachable at every size. Watchlist puts the address form and its primary action on the first screen.

Board and Book were rendered at 320, 390, 768, 1024 and 1440px. No page overflow was measured. The board was also checked with a 32px root (200% CSS text enlargement) and with a separate RTL mirror at 390px. Native browser zoom and translated content were not verified.

## Elevation & Depth

The interface is flat: no shadows, floating overlays or nested elevated cards. A one-pixel structural border separates related data. Surface, header and hover tokens provide tonal hierarchy. The status notice is in normal document flow, with a dismiss control; it does not cover data. The footer/status strip is also in flow.

## Shapes

Buttons and fields use a 3px radius; badges, selected controls and icon buttons use 2px. Status dots are round, allocation marks are small squares, and the custom Book Desk mark is a pair of outlined book spines. Book identity marks show the real symbol's first characters, with one of four established palette treatments. No API logos or remote image assets are required.

The only intentional clipping is the screen-reader-only utility and visually hidden mobile table headers. Critical visible values are not ellipsized. Native single-line address inputs can scroll their editable value; the selected token is also printed in full below the Book heading.

## Components

`src/components.tsx` contains the reusable primitives:

| Component | Use and behavior |
| --- | --- |
| `Icon` | One custom SVG set, `currentColor`, 1.5px strokes; decorative icons are hidden from assistive technology |
| `Metric` | Label, mono value, note and optional signed tone; shared across board and Book |
| `Section` | Bordered flat data section with heading, optional utility and content; headings wrap when needed |
| `PhaseBadge` | Named phase with redundant text and dot; trading/raising/aborted use semantic status colors |
| `PinButton` | Native button with `aria-pressed`; accessible Watch/Unwatch name; the active star is filled and orange |
| `Address` | Full wrapping address, or a compact board summary with a full title; detail disclosures retain complete values |
| `BookMark` | Compact identity mark derived from a real Book symbol |
| `NavChart` | Real local observations, 1h/24h/all range buttons, pointer inspection, sample count and a text data disclosure; a single observation is a point with an explicit collection message |
| `ErrorNotice` | Error context and Retry; last successful data is labeled when retained |
| `Empty` | Task-specific empty state with a clear next action |

Page patterns in `src/App.tsx` include the searchable/sortable `Board`, address-setting `Watchlist`, `Holdings`, `Settlement`, `ChainPanel`, `Targets` and `TradeFeed`. Keep source-reported trust and valuation information distinct from factory-confirmed fields. The settlement calculator labels errors next to its field and rejects negative or above-supply amounts. Its LP pot includes uncollected fees; the fee component is disclosed in the panel note. Trade loading and empty states identify exactly which block windows have been scanned.

Buttons have rest, hover, pressed, disabled and keyboard-focus states. Pointer hover styles are guarded by `(hover: hover)`. Color/border/transform transitions last 120ms, with a 0.96 press scale only under `prefers-reduced-motion: no-preference`. There are no continuous animations. Native disclosures and selects provide their own keyboard behavior. A skip link is the first tab stop and focuses the current heading while preserving the hash route; route changes and the arrival of asynchronous Book data focus the page heading once, without subsequent polls stealing focus. Fields have persistent labels, field errors use associated descriptions, and routine results use status announcements.

## Do's and Don'ts

- Start a new data view with the existing page heading, `Metric` strip and `Section` pattern; reuse `.detail-grid` or `.board-layout` when its content fits.
- Use one orange filled primary action in a task group. Use neutral buttons for refresh/secondary actions when the page already has the Watch Book primary control.
- Keep prose in the system font and numeric comparisons in `--mono`. Use the six-size scale and existing semantic colors.
- Preserve the actual source name, address and phase. Uppercase names supplied by traders are data, not a reason to rewrite them to satisfy a casing heuristic.
- Include loading, empty, error and retry behavior next to each public read. Show stale and partial data honestly; do not seed charts or manufacture market activity.
- Extend the responsive per-row pattern when adding a board field. Do not solve narrow layouts by clipping addresses or hiding required comparison data.
- Retain the public, read-only model. Adding wallets or signing controls would change the product's scope.

The guidance and documentation-method attribution and licenses are retained in `README.md` and `third-party/`.
