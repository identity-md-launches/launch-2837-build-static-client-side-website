# Book Desk

A static terminal for Mancer Books on Robinhood Chain (4663). Compare public vault backing, inspect holdings and executed trades, and keep one Book on a local watchlist. No wallet, transactions, backend, API key or environment file is needed.

## Install, develop and preview

Node.js 24 and npm were used for this delivery. The exact dependency graph is in `package-lock.json`.

```sh
npm ci
npm run dev
```

To rebuild and serve the production export:

```sh
npm run typecheck
npm test
npm run build
npm run preview -- --port 4173
```

Open `http://localhost:4173`. `dist/` is the finished deliverable; copy its complete contents to any static host. It contains the HTML, JavaScript, CSS, two local WOFF2 font files, favicon, PNG share image and runtime license notices. Vite uses `base: './'`, and navigation uses URL hashes, so hosting below a gateway subpath needs no route rewriting. Use HTTP(S) rather than opening the HTML with `file://`.

## Use the desk

- **Board:** Every phase is requested, including Aborted, and subsequent API pages are collected. Search by Book name, symbol, token or trader address. Filter phases and sort by name, phase, NAV, return, price/backing, time left, trader or trust. Missing values remain unavailable rather than becoming zero.
- **Book:** Select a Book name to inspect its holdings and shares, locally collected NAV observations, executed vault trades, registered traders, factory checks, target tokens and settlement estimate. Addresses are available in full through the detail page and disclosures.
- **Watchlist:** Select a star, or enter a Book **token** address. A new pin replaces the previous pin. The pin is saved in localStorage and written into `?book=…`; opening that query without a hash opens Watchlist. Explicit `#/board` still opens the board. Unpin removes the query and local pin.

Routes are `#/board`, `#/book/<token>` and `#/watchlist`. There is no default or invented Book address. A supplied invalid address produces a recoverable error.

## Public data and calculations

All application data is fetched in the visitor's browser:

| Source | Usage |
| --- | --- |
| `https://api.mancer.xyz/v1/books` | Board, all phases, pagination, token metadata; polled every 15 seconds |
| `https://api.mancer.xyz/v1/books/{token}` | Book valuation, holdings, targets, trust and settlement inputs; every 15 seconds |
| `https://api.mancer.xyz/v1/prices` | ETH/USD and token metadata; every 60 seconds |
| `https://api.mancer.xyz/health` | API and chain health; every 60 seconds |
| `https://rpc.mainnet.chain.robinhood.com` | Public JSON-RPC reads and event logs; chain snapshot and recent trades every 30 seconds |

Polling pauses in hidden tabs and refreshes when the tab becomes visible. Refresh buttons request data immediately; Refresh board also updates prices and health. Failed board/detail refreshes retain the last successful response with an explicit stale-data notice. A failed ETH price request uses fresh Book metadata when available; if both sources fail, USD becomes unavailable. The API's partial, approximate and stale-price flags are disclosed where applicable.

The factory is **`0xa727e7AF47A965afD0341AfCEF7Bc3F86be876b0`**. `bookIdOfToken(address)` resolves the token's ID; `bookOf(uint256)` verifies the token and returns its vault. The client then reads `tradersOf`, `costBasis`, `unlockAt`, and the confirmed vault's `trackedTokens()` and `trackedBalance(address)`, all at the same RPC block. Every tracked balance is requested, four calls at a time. No ABI library, wallet provider or signing code is shipped. Read selectors and the event signature are documented in `src/config.ts`.

The detail endpoint expands `vault` into an object; `src/api.ts` normalizes its address before rendering. On-chain fields are distinct from API valuations, which may be from another block. Public endpoint availability and CORS remain external dependencies.

NAV is the API's `value.navWei`, in ETH. USD multiplies NAV by the WETH price from `/v1/prices`, with API token metadata as a fallback. Total NAV sums valued Books and identifies how many were valued. Mean return is the unweighted mean of reported non-null return bps. One basis point is 0.01%. Price/backing is the reported `priceToBackingBps / 10,000`. Trust and verification labels are attributed to Mancer; they are not synthesized scores.

Settlement uses integer `bigint` arithmetic with floor rounding:

```text
closeFee  = floor(NAV × 200 / 10,000)
profit    = max(NAV − closeFee − costBasis, 0)
traderCut = floor(profit × 2,000 / 10,000)
holderPot = NAV − closeFee − traderCut + lpPot
```

The API's `lpPotWei` already includes `owedLpFeesWei`; uncollected fees are disclosed as a component of the LP pot. They are not added a second time. The optional quantity calculator divides this estimated holder pot by circulating token supply. Displayed quantities are rounded estimates; negative amounts and amounts above the current circulating supply are rejected. Execution slippage is excluded. For settled Books, the panel explicitly identifies its numbers as reference estimates.

The trade feed decodes the confirmed vault's `TradeExecuted` logs. It requests the latest **2,000,000 blocks**, with an action to scan the previous window. It is explicitly a block-window feed, not complete lifetime history. Log identities are deduplicated; block timestamps are fetched for the latest 30 events in each window. Older events retain their block references. The target list displays the trader's actual addresses, with unset slots disclosed up to the vault's 16-token target limit; targets are not presented as holdings.

NAV history starts with real observations while a Book is open. It is not backfilled from a fabricated series. localStorage keeps the latest observation per API timestamp minute, bounded to 1,440 samples per Book (`bookdesk.history.v1.<token>`). Partial or stale-feed valuations are not added. `bookdesk.pin.v1` stores the single watch pin. Storage errors show a persistence warning. History and pins are local to this browser and origin, not synchronized between visitors.

## Validation results

The worker ran the production build, typecheck, 13 unit/API tests and the production-export interaction suite. The suite serves `dist/` at a nested `/book-desk/` path. It exercises live public responses, then separate controlled failure and timer scenarios using captured responses; no fixtures or generated balances are included in the app.

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium webkit
npm run validate
npm run check:export
```

For a restricted machine, Playwright supports `PLAYWRIGHT_BROWSERS_PATH` pointing to a writable browser installation. The validation script also accepts an optional `BOOK_DESK_TEST_RPC` transport override for local verification; the exported site's RPC remains the public endpoint above. Neither setting is required by the website.

Actual final results and evidence are in [artifacts/validation.md](artifacts/validation.md), [interaction-results.json](artifacts/interaction-results.json) and [taste-results.json](artifacts/taste-results.json). On 2026-11-01:

- Production build and `tsc --noEmit` passed; all 13 unit/API tests passed. Settlement calculations were also checked against all 13 currently valued Books, including nonzero uncollected LP fees, with exact matches to the API estimates.
- All 25 production interaction checks passed in Chromium, including six automated accessibility scans with no detected A/AA violations.
- Board and Book pages had no page overflow at 320, 390, 768, 1024 and 1440 pixels. Product, refresh and search were visible on the first 390-pixel screen.
- The pinned taste probe passed 15 of 16 checks. Its only remaining flag is the API-supplied Book name **BEEP BOOP TRADER**, which is preserved as source data. Render, layout, contrast, controls, typography, first-screen copy, motion and metadata checks passed.
- WebKit could not launch because the available runtime lacks required host libraries, including GTK4 and GStreamer. The provided browser connector also could not launch its configured Chrome installation; direct Playwright Chromium was used instead. Safari, physical devices, screen readers and browser-native 200% zoom are **not verified**. CSS text enlargement to 200% and an RTL mirror were checked separately.

The pinned probe was run before delivery with:

```sh
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

The pinned input guide and probe are assignment inputs and are removed before delivery. The application, rebuild and `npm run validate` do not depend on them. `test/scratch/` is temporary and is not shipped. These are worker observations, not independent certification.

## Source map and packaging

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Board, Watchlist and Book page composition |
| `src/components.tsx` | Metrics, status badges, chart, sections, controls and recoverable states |
| `src/api.ts`, `src/config.ts`, `src/types.ts` | Typed public reads, contract signatures, chain configuration |
| `src/model.ts`, `src/storage.ts`, `src/hooks.ts` | Sorting, calculations, local observations, polling and routing |
| `src/style.css` | Final design tokens, component styles and responsive rules |
| `tests/`, `scripts/validate.mjs` | Calculation/API regressions and browser interaction validation |
| `public/`, `assets/share-source.svg` | Runtime favicon/share image and the editable share artwork |
| `dist/` | Complete production export, included alongside source and lockfile |

See [DESIGN.md](DESIGN.md) for the implemented system. Generated dependencies and caches are excluded at every nesting level. `.gitignore` gives each ignored path an explicit zero-byte submission budget; it deliberately includes `dist/`. No dependency archives, registry mirror or submodule is needed. The complete selected deliverable is well below the 8 MiB submission limit; the final size check is recorded in the validation report.

Design guidance is adapted from [Jakub Krehel's Better Interface](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface) (MIT, pinned commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`). The documentation method is adapted from [Paul Bakaus's Impeccable](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md) (Apache-2.0, pinned commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`). The retained notices are in `third-party/design-guidance-LICENSE.txt`. IBM Plex Mono is copyright IBM Corp., licensed under SIL OFL 1.1; its notice is in `third-party/ibm-plex-mono-LICENSE.txt`. Runtime React, font and Vite helper licenses are also preserved in `public/third-party-notices.txt` and its exported copy.
