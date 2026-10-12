# Plan: Order Page (SKU Picker)

> A purchase-style `/order` page: pick a location, then repeatedly pick product → option values → SKU, building a list; submit re-validates the list server-side and displays the confirmed SKUs.

## Research Summary

- **Stack:** Payload 3.90 on Next.js 16 App Router (`src/app/(frontend)`), React 19, SQLite, TypeScript, Biome (tabs, double quotes), Vitest (jsdom, `tests/int/**/*.int.spec.ts`), Playwright e2e.
- **Relevant patterns:**
  - Catalog resolution already exists in `src/lib/catalog.ts`: `getLocationCatalog` (location → org → client, first non-empty level wins), `getAvailableProducts` (active products only), `getAvailableSkus` (paginated, `skuWhereForEntry`: empty `skus` = all SKUs of the product). Pure helpers there are unit-tested in `tests/int/catalog.int.spec.ts` with no DB.
  - Frontend pages get Payload via `getPayload({ config })` and auth via `payload.auth({ headers })` (`src/app/(frontend)/page.tsx`). `@payload-config` alias is used in `src/app/my-route/route.ts`.
  - Collections define no `access`, so Payload's default applies: any logged-in user can read. Local API calls default to `overrideAccess: true`.
  - SKU = product + `productOptionValues` (exactly one value per option of the product, unique combo — enforced in `src/collections/Skus.ts`). SKUs have no title; display as product title + value titles.
  - Global styles in `src/app/(frontend)/styles.css` (dark theme, native CSS nesting).
- **Key files:** `src/lib/catalog.ts`, `src/collections/{Skus,ProductOptions,ProductOptionValues,Locations}.ts`, `src/payload-types.ts`, `src/app/(frontend)/page.tsx`, `src/app/(frontend)/styles.css`, `tests/int/catalog.int.spec.ts`.
- **New dependencies:** none.
- **Risks/Considerations:**
  - Server actions are public HTTP endpoints — each one must check auth itself, not rely on the page.
  - Stale responses when the user switches location/product quickly must be ignored.
  - `getAvailableSkus` is paginated (limit 50); the picker needs *all* allowed SKUs of a product, so it uses `pagination: false` instead.

## Tasks

### Phase 1: Data & Picker Logic

#### 1.1. [x] Product configuration + submit validation resolvers
- **What:** In `src/lib/catalog.ts`:
  - Extract the "location's entry for an active product" lookup from `getAvailableSkus` into a private `getActiveEntry(payload, locationId, productId, { req })` returning `EntryIds | null`; make `getAvailableSkus` use it (behavior unchanged).
  - Add `getProductConfiguration(payload, locationId, productId, { req })` → `ProductConfiguration | null` (null when no active entry). Loads, all `depth: 0, pagination: false`:
    - allowed SKUs via `skuWhereForEntry(entry)` with `select: { productOptionValues: true }` → `{ id, valueIds }[]`;
    - the product's `productOptions` (`select: { title }`, `sort: "createdAt"`);
    - the `productOptionValues` used by those SKUs (`id in usedValueIds`, `select: { title, productOption }`, `sort: "createdAt"`), grouped under their option.
  - Add `getAllowedSkus(payload, locationId, skuIds, { req })` → `{ allowed: SelectedSku[]; rejected: number[] }`. Resolve the location catalog once, keep entries whose product is active, then `payload.find` skus where `id in skuIds AND or(entries.map(skuWhereForEntry))` at `depth: 1`, mapped to `{ id, productTitle, valueTitles }`. Any requested id not returned goes to `rejected`.
  - New exported types (plain, serializable — passed to the client): `ConfigOption = { id; title; values: { id; title }[] }`, `ConfigSku = { id; valueIds: number[] }`, `ProductConfiguration = { options: ConfigOption[]; skus: ConfigSku[] }`, `SelectedSku = { id; productTitle; valueTitles: string[] }`. Put these types in `src/lib/configurator.ts` (task 1.2) and import them here, so the client never imports `catalog.ts`.
- **Files:** `src/lib/catalog.ts`
- **Verify:** `pnpm exec tsc --noEmit`; existing `pnpm test:int` still passes; scratch `tsx` script (in scratchpad, not committed) against the dev DB for one location: print `getProductConfiguration` for a product whose entry lists specific SKUs and one whose entry is empty (all SKUs), and `getAllowedSkus` with one allowed and one foreign SKU id.

#### 1.2. [x] Pure picker helpers
- **What:** New client-safe `src/lib/configurator.ts` (no Payload runtime imports) with the types above plus:
  - `matchingSkus(skus, picks)` — SKUs whose `valueIds` contain every non-null pick.
  - `availableValues(option, skus, picksBefore)` — values of `option` used by at least one SKU matching the picks of earlier options (so every offered value leads to a SKU: no dead ends).
  - `resolveSku(options, skus, picks)` — the single matching SKU once every option has a pick, else `null`.
  - `picks` is `(number | null)[]` indexed by option position; changing pick *i* clears picks after *i* (a `setPick(picks, index, valueId)` helper).
- **Files:** `src/lib/configurator.ts`
- **Verify:** `pnpm exec tsc --noEmit`

#### 1.3. [x] Unit tests for picker helpers
- **What:** Tests with a 2-option fixture (e.g. size × colour) where not every combination is an allowed SKU: available values narrow after the first pick; restricted values are hidden; `resolveSku` returns null until all picked, then the exact SKU; `setPick` clears later picks; product with zero allowed SKUs yields no values.
- **Files:** `tests/int/configurator.int.spec.ts`
- **Verify:** `pnpm test:int`

### Phase 2: Server Actions & Page

#### 2.1. [x] Server actions with auth
- **What:** New `src/app/(frontend)/order/actions.ts` (`"use server"`). Shared `requireUser()` helper: `getPayload({ config })` + `payload.auth({ headers: await headers() })`, throws `"Not authenticated"` if no user. Validate inputs are positive integers (`Number.isInteger`, small inline guard — Zod isn't a dependency and three id params don't justify adding it). Actions:
  - `listProducts(locationId)` → `{ id, title }[]` via `getAvailableProducts`.
  - `loadProductConfiguration(locationId, productId)` → `ProductConfiguration | null` via `getProductConfiguration`.
  - `submitSelection(locationId, skuIds)` → `getAllowedSkus` result; dedupe ids first; reject empty list.
  - Missing location (`findByID` throws NotFound) surfaces as a thrown error the client displays.
- **Files:** `src/app/(frontend)/order/actions.ts`
- **Verify:** `pnpm exec tsc --noEmit`; `pnpm lint`

#### 2.2. [x] Order page (server component)
- **What:** `src/app/(frontend)/order/page.tsx`: auth the user; if none, render a short message with a link to `/admin/login` (and stop). Otherwise load locations `status: active`, `depth: 1`, `select: { title, organization }`, `pagination: false`, `sort: "title"`; map to `{ id, title, organizationTitle }` and render `<OrderForm locations={...} />`. Add an "Order" link on the home page (`src/app/(frontend)/page.tsx`) next to the existing links — don't change the `h1` text (e2e test asserts it).
- **Files:** `src/app/(frontend)/order/page.tsx`, `src/app/(frontend)/page.tsx`
- **Verify:** `pnpm dev`, visit `/order` logged out → login prompt; logged in → location dropdown grouped by organization (`<optgroup>`), only active locations.

#### 2.3. [x] Order form (client component)
- **What:** `src/app/(frontend)/order/OrderForm.tsx` (`"use client"`). State: `locationId`, `products`, `productId`, `config`, `picks`, `lines: SelectedSku[]`, `result`, `error`, plus loading flags.
  - **Location select** → clears product/config/picks/lines/result; calls `listProducts`. Spinner + disabled product select while loading. Empty → "No products are available for this location."
  - **Product select** → calls `loadProductConfiguration`; **spinner while options load**, option selects hidden until loaded. `config.skus` empty / null → "No SKUs of this product are available here."
  - **Option selects**, rendered in order; option *i* disabled until option *i-1* picked; its values from `availableValues`. Changing a pick uses `setPick`.
  - When `resolveSku` returns a SKU → "Add" button; disabled with "Already added" if that SKU id is in `lines`. Adding builds `SelectedSku` from config titles, then resets product/picks for the next item.
  - **Selection list** with per-line Remove. **Submit** (disabled when list empty, spinner while submitting) → `submitSelection`; show confirmed SKUs (id, product, values) and any rejected ids as a warning.
  - **Stale responses:** a `useRef` request counter per async call; ignore results whose token isn't the latest.
  - Errors from actions caught and shown inline; loading state always reset in `finally`.
- **Files:** `src/app/(frontend)/order/OrderForm.tsx`
- **Verify:** `pnpm exec tsc --noEmit`; `pnpm lint`; manual run in 2.4.

#### 2.4. [x] Styles + manual end-to-end check
- **What:** Add `.order` styles to `styles.css`: stacked form fields, readable selects/buttons on the dark background, list rows, a CSS-only `.spinner` (rotating border, `@keyframes`) with `role="status"` / `aria-label="Loading"` in markup, and `prefers-reduced-motion` fallback. Then exercise the flow against the dev DB (create catalog entries in admin if the seed has none): location with own entries, one inheriting from org, one from client; entry with listed SKUs vs empty; add two SKUs of the same product; duplicate blocked; switch location clears list; submit shows confirmed SKUs.
- **Files:** `src/app/(frontend)/styles.css`
- **Verify:** manual checklist above passes; `pnpm test:int` and `pnpm lint` clean.

## Notes

- **Decisions (confirmed with user):** new `/order` route; login required; active locations only; ordered + filtered option cascade; same product may appear multiple times with different SKUs, same SKU once; submit validates & displays, nothing saved.
- **Out of scope:** persisting orders, quantities, pricing, statuses beyond active products and active locations (option/value/SKU status ignored — consistent with the catalog-entries plan), an e2e test (the seed creates no catalog entries; add one later together with seeded entries if wanted).
- **Access:** actions run with `overrideAccess` default (true) after confirming a logged-in user. Since collections have no custom `access`, any logged-in user could already read all of this via REST, so this doesn't widen anything. Revisit if per-user access is added later.
- **Why values come from SKUs, not the option's join:** only values used by an allowed SKU are loaded, which naturally respects entries that list specific SKUs and avoids offering values with no SKU.
- **Location change while list is non-empty** silently clears the list (no confirm dialog) — easy to add later.

## Completed

- **Date:** 2026-10-12
- **All tasks executed successfully:** yes
- **Files changed:**
  - `src/lib/configurator.ts` — new: client-safe picker types and helpers (`matchingSkus`, `availableValues`, `setPick`, `resolveSku`)
  - `src/lib/catalog.ts` — extracted `getActiveEntry` (used by `getAvailableSkus`); added `getProductConfiguration` and `getAllowedSkus`
  - `tests/int/configurator.int.spec.ts` — new: 9 unit tests for the picker helpers
  - `src/app/(frontend)/order/actions.ts` — new: `listProducts`, `loadProductConfiguration`, `submitSelection` server actions, each requiring a logged-in user
  - `src/app/(frontend)/order/page.tsx` — new: login gate, active locations grouped by organization
  - `src/app/(frontend)/order/OrderForm.tsx` — new: cascading form with spinners, stale-response guard, selection list, submit result
  - `src/app/(frontend)/page.tsx` — "Order" link
  - `src/app/(frontend)/styles.css` — order form, list and spinner styles
- **Deviation:** fields use `<label htmlFor>` + `id` instead of a wrapping `<label>`, so each select's accessible name is just its label (a wrapping label also included the selected option's text).
- **Added after build:** a Client select before Location (active clients) that stands in for per-client login: it only filters the locations offered, and changing it resets everything below. The server actions don't check it — real scoping needs users linked to clients plus access rules.
- **How to test:** `pnpm test:int`; log in at `/admin`, open `/order`, pick a client, then a location → product → each option value → Add; repeat; Submit. Verified with a Playwright script against a DB copy: location-level entry (all SKUs), org-level entry overriding client (one SKU), location without a catalog, option spinner, ordered/disabled option selects, duplicate SKU blocked, location change clears the list, submit confirms SKUs.
- **Follow-up items:**
  - The submit result lists value titles in the SKU's stored order (e.g. Size / Style / Colour) and rows in DB order, which differs from the selection list's option order. Sort in `getAllowedSkus` by option order and requested ID order.
  - No e2e test (seed has no catalog entries); Playwright browsers aren't installed locally (`pnpm exec playwright install`).
  - Changing location clears the list without a confirmation prompt.
