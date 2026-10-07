# Plan: Location SKU Catalog

> Link Clients, Organizations and Locations to the products/SKUs they may choose from, with Location → Org → Client override semantics, and a resolver that answers "which products / which SKUs of product P can location X pick".

## Research Summary

- **Stack:** Payload CMS 3.90.2 on Next.js 16, SQLite adapter (schema push in dev, no migrations), TypeScript, Biome (tabs, double quotes), Vitest for int tests (`tests/int/**/*.int.spec.ts`).
- **Hierarchy today:** `clients` ← `organizations.client` (required) ← `locations.organization` (required). Clients/Orgs expose reverse `join` fields. Nothing links any of them to products or SKUs.
- **Relevant patterns:**
  - Shared fields live in `src/collections/common.ts` (`titleField`, `handleField`, `generalStatusField`) and are reused across collections.
  - `Skus.ts` uses relationship `filterOptions` with `extractID` from `payload/shared`; the default `relationship` validator enforces `filterOptions` on save, so filtered options are also validated.
  - Products have `status` (draft/active/archived); SKUs have **no** status.
  - No access control on these collections (admin-only by default) — stays as is.
- **Key files:** `src/collections/common.ts`, `src/collections/Clients.ts`, `src/collections/Organizations.ts`, `src/collections/Locations.ts`, `src/collections/Skus.ts`, `src/payload-types.ts`, `tests/int/api.int.spec.ts`, `vitest.config.mts`.
- **New dependencies:** none.
- **Risks/Considerations:**
  - Schema change is pushed to the dev DB on next `pnpm dev` (new `*_rels` rows only; additive, no data loss).
  - Int tests run against the real `DATABASE_URL`; keep resolver logic pure so tests don't need DB fixtures.

## Design

**Data:** each of Clients, Organizations, Locations gets a `catalog` group field:

| Field | Type | Notes |
|---|---|---|
| `catalog.products` | relationship → `products`, `hasMany` | Products this level may choose from. |
| `catalog.skus` | relationship → `skus`, `hasMany` | Optional narrowing. `filterOptions`: `product in catalog.products` (none selected → no options). |

Stored by Payload in the existing `clients_rels` / `organizations_rels` / `locations_rels` tables — no separate collection.

**Resolution rules (for a location):**
1. **Override, not merge.** Use the first level with a non-empty `catalog.products`, in order Location → Organization → Client. If none has any, the location's catalog is empty.
2. **Products** available = that level's `catalog.products`, excluding products whose `status !== "active"`.
3. **SKUs for product P** (P must be in step 2's set):
   - if the level's `catalog.skus` contains any SKU of P → only those SKUs;
   - otherwise → all SKUs of P.
4. Orgs/locations are free to pick any product (no subset-of-parent check).

This matches the future page flow (pick product → paginated SKU list for that product) without loading every SKU at once, and new SKUs of an assigned product are picked up automatically.

## Tasks

### Phase 1: Data Layer

#### 1.1. [x] Add shared `catalogField` to common fields
- **What:** Export `catalogField: Field` from `common.ts` — a `group` named `catalog` (label "SKU Catalog", with an admin description explaining override + "leave empty to inherit from parent") containing:
  - `products`: `relationship`, `relationTo: "products"`, `hasMany: true`.
  - `skus`: `relationship`, `relationTo: "skus"`, `hasMany: true`, admin description "Leave empty to allow every SKU of the selected products", `filterOptions: ({ siblingData })` → `false` if no products, else `{ product: { in: siblingData.products.map(extractID) } }`.
  - **Auto-prune** on `skus` via a field `hooks.beforeValidate` (must be `beforeValidate`, not `beforeChange` — validation runs before `beforeChange`, and the default relationship validator would reject orphaned SKUs first): if `value` is empty return it; else one `req.payload.find({ collection: "skus", where: { id: { in: valueIds } }, select: { product: true }, depth: 0, pagination: false, req })`, then return `pruneOrphanSkus(...)` from `src/lib/catalog.ts` (task 2.1). Keeps the original order. With no products selected → returns `[]`.
  - The default relationship validator still runs after the hook as a safety net.
- **Files:** `src/collections/common.ts`
- **Verify:** `pnpm exec tsc --noEmit` passes (after 2.1's `pruneOrphanSkus` exists — build 2.1's pure helpers first if needed).

#### 1.2. [x] Add `catalogField` to Clients, Organizations, Locations
- **What:** Append `catalogField` to the `fields` array of each collection.
- **Files:** `src/collections/Clients.ts`, `src/collections/Organizations.ts`, `src/collections/Locations.ts`
- **Verify:** `pnpm generate:types` updates `src/payload-types.ts` with `catalog?: { products?: (number | Product)[] | null; skus?: (number | Sku)[] | null }` on all three; `pnpm exec tsc --noEmit` and `pnpm lint` pass.

#### 1.3. [x] Manual admin check
- **What:** Run `pnpm dev`, open a Location: the SKU picker shows nothing until a product is selected, then only SKUs of selected products. Select products A and B + one SKU of A and one of B, save, then remove A and save → save succeeds and the A SKU is gone from `catalog.skus` while the B SKU stays.
- **Files:** none
- **Verify:** behaviour as described; schema push completes without a data-loss prompt.

### Phase 2: Resolver

#### 2.1. [x] Pure resolution helpers
- **What:** Create `src/lib/catalog.ts` with pure, DB-free functions over IDs:
  - `type CatalogIds = { products: number[]; skus: number[] }` and `toCatalogIds(catalog)` normalising a `catalog` group (populated or ID values) via `extractID`.
  - `pickEffectiveCatalog(levels: CatalogIds[]): CatalogIds | null` — first level (ordered location, org, client) with `products.length > 0`, else `null`.
  - `skuFilterForProduct(catalog: CatalogIds, productId: number, skuProductById: Map<number, number>): { kind: "none" } | { kind: "all" } | { kind: "only"; skuIds: number[] }` — `none` if product not in catalog; `only` if any catalog SKU maps to that product; else `all`.
  - `pruneOrphanSkus(skuIds: number[], productIds: number[], skuProductById: Map<number, number>): number[]` — keeps SKUs whose product is in `productIds` (unknown/deleted SKUs dropped), preserving order. Used by the 1.1 hook.
- **Files:** `src/lib/catalog.ts`
- **Verify:** `pnpm exec tsc --noEmit` passes.

#### 2.2. [x] Payload-backed resolver functions
- **What:** In the same file, add functions taking `(payload: Payload, ...)` (optionally `req` to share transactions):
  - `getLocationCatalog(payload, locationId)` — load location (depth 0), its organization (depth 0), then client (depth 0) with `select: { catalog: true, ... }`; return `pickEffectiveCatalog(...)` plus which level won (`"location" | "organization" | "client" | null`) for debugging/UI.
  - `getAvailableProducts(payload, locationId)` — `payload.find` products where `id in catalog.products` and `status equals "active"`, `pagination: false`.
  - `getAvailableSkus(payload, locationId, productId, { page, limit })` — returns empty if product not allowed/not active; otherwise `payload.find` skus where `product equals productId` and, for `only`, `id in skuIds`; paginated (default limit e.g. 50). Fetch product IDs for catalog SKUs with a single `select: { product: true }` query to build the map for `skuFilterForProduct`.
- **Files:** `src/lib/catalog.ts`
- **Verify:** `pnpm exec tsc --noEmit`; ad-hoc check with a scratch `tsx` script against a **copy** of the dev DB (set `DATABASE_URL` to the copy) for a location with/without its own catalog.

#### 2.3. [x] Unit tests for resolution rules
- **What:** Test the pure helpers only (no DB):
  - location non-empty overrides org and client (client has A, location has B → B only);
  - empty location falls back to org, then client; all empty → `null`;
  - a level with only `skus` but no `products` cannot occur (filterOptions) — `pickEffectiveCatalog` keys on `products`;
  - `skuFilterForProduct`: product not in catalog → `none`; product with listed SKUs → `only` with just that product's SKUs (other products' SKUs ignored); product without listed SKUs → `all`;
  - `toCatalogIds` handles populated docs, raw IDs, `null`/`undefined`;
  - `pruneOrphanSkus`: drops SKUs of removed products, keeps the rest in order, drops IDs missing from the map, returns `[]` when no products.
- **Files:** `tests/int/catalog.int.spec.ts` (Vitest only picks up `*.int.spec.ts`)
- **Verify:** `pnpm exec vitest run --config ./vitest.config.mts tests/int/catalog.int.spec.ts` passes.

## Notes

- **Why fields, not a linkage collection:** links carry no data, and Payload already persists `hasMany` relationships in `*_rels` join tables. A separate `catalogAssignments` collection is worth it only if links later need their own data (price, qty, dates) or lists grow very large — easy migration path since the resolver is the single read point.
- **Override is whole-level, not per-product.** If a location lists only product B, it loses every client/org product — by design (per user). If per-product overrides are wanted later, change `pickEffectiveCatalog` only.
- **Stale SKUs (decided: auto-prune):** removing a product from `catalog.products` silently drops its SKUs from `catalog.skus` on save (task 1.1 hook). Chosen over a validation error because removing a product clearly implies its SKUs too.
- **Statuses:** only product `status` is checked. Client/org/location `status` and SKU archiving are out of scope (SKUs have no status since the auto-generation work was dropped).
- **Out of scope:** the picker page, API endpoints, storing a location's selections, access control changes, seed changes.
- **Leftover:** the dev DB `skus` table still has an orphaned `status` column from the reverted auto-SKU work; unrelated, but the next schema push may prompt about it.

## Completed

- **Date:** 2026-10-07
- **All tasks executed successfully:** yes
- **Files changed:**
  - `src/collections/common.ts` — `catalogField` group (`products`, `skus`) with SKU `filterOptions` and a `beforeValidate` hook that prunes SKUs of unselected products
  - `src/collections/Clients.ts`, `Organizations.ts`, `Locations.ts` — added `catalogField`
  - `src/payload-types.ts` — regenerated
  - `src/lib/catalog.ts` — pure helpers (`toCatalogIds`, `pickEffectiveCatalog`, `skuFilterForProduct`, `pruneOrphanSkus`) and resolvers (`getLocationCatalog`, `getAvailableProducts`, `getAvailableSkus`)
  - `tests/int/catalog.int.spec.ts` — 12 unit tests for the pure helpers
- **Deviations:** `pruneOrphanSkus` was written before task 1.1 (the hook depends on it). Task 1.3 was verified via the Local API against a DB copy instead of clicking through the admin UI. `getLocationCatalog` also returns `source` as planned.
- **How to test:** `pnpm exec vitest run --config ./vitest.config.mts tests/int/catalog.int.spec.ts`; in admin, edit a Location's "SKU Catalog", select products, then SKUs (picker only lists SKUs of the selected products); remove a product and save — its SKUs drop out.
- **Follow-up items:** no `pnpm dev` run yet, so the dev DB still lacks the new `catalog` rels; the leftover `skus.status` column remains in the dev DB; client/org/location `status` is not considered by the resolver.
