# Plan: SKU Catalog Entries

> Link Clients, Organizations and Locations to the products/SKUs they may choose from via a separate `catalogEntries` collection, with Location → Org → Client override semantics, and a resolver that answers "which products / which SKUs of product P can location X pick".

## Research Summary

- **Stack:** Payload CMS 3.90.2 on Next.js 16, SQLite adapter (schema push in dev, no migrations), TypeScript, Biome (tabs, double quotes), Vitest for int tests (`tests/int/**/*.int.spec.ts`).
- **Hierarchy today:** `clients` ← `organizations.client` (required) ← `locations.organization` (required). Clients/Orgs expose reverse `join` fields.
- **Current catalog (to be replaced):** a shared `catalogField` group (`catalog.products`, `catalog.skus`) in `src/collections/common.ts` on all three collections, with a `pruneCatalogSkus` `beforeValidate` hook; resolver + pure helpers in `src/lib/catalog.ts`; tests in `tests/int/catalog.int.spec.ts`.
- **Relevant patterns:**
  - Shared fields live in `src/collections/common.ts` and are reused across collections.
  - `Skus.ts` uses relationship `filterOptions` with `extractID` from `payload/shared`; the default `relationship` validator enforces `filterOptions` on save.
  - Collections are registered in `src/payload.config.ts` wrapped in `withGroup(Collection, "<Group>")`.
  - Products have `status` (draft/active/archived); SKUs have **no** status.
  - No access control on these collections (admin-only by default) — stays as is.
- **SQL adapter detail:** single (non-polymorphic) relationship fields are real columns, so they can be part of collection `indexes`; polymorphic and `hasMany` relationships live in `_rels` and cannot. Hence three owner fields instead of one polymorphic `owner`. SQLite treats NULLs as distinct, so `unique` on `(location, product)` only constrains rows where `location` is set.
- **Key files:** `src/collections/common.ts`, `src/collections/Clients.ts`, `src/collections/Organizations.ts`, `src/collections/Locations.ts`, `src/collections/Products.ts`, `src/collections/Skus.ts`, `src/payload.config.ts`, `src/lib/catalog.ts`, `src/payload-types.ts`, `tests/int/catalog.int.spec.ts`.
- **New dependencies:** none.
- **Risks/Considerations:**
  - Schema push drops the old `catalog` rels rows and creates `catalog_entries` tables; dev data is re-entered by hand, not migrated.
  - Int tests run against the real `DATABASE_URL`; keep resolver logic pure so tests don't need DB fixtures.

## Design

**Data:** new collection `catalogEntries` — one document per (owner, product):

| Field | Type | Notes |
|---|---|---|
| `client` / `organization` / `location` | relationship → that collection, single | Exactly one must be set (field-level validation). |
| `product` | relationship → `products`, required | |
| `skus` | relationship → `skus`, `hasMany` | Optional. **Empty = every SKU of the product** (new SKUs picked up automatically). `filterOptions`: `product equals <this entry's product>`; none selected → no options. |

Collection `indexes`: `{ fields: ["client", "product"], unique: true }`, same for `organization` and `location`.

Clients / Organizations / Locations each get a `join` field (`collection: "catalogEntries"`, `on: "client" | "organization" | "location"`) so entries are listed and added from the parent.

**Resolution rules (for a location):**
1. Load location → organization → client IDs, then **one** query: `catalogEntries where location = L OR organization = O OR client = C`.
2. **Override, not merge.** The most specific level with **any** entries wins outright (Location → Organization → Client); other levels are ignored entirely. None → empty catalog.
3. **Products** available = the winning level's entries' products, excluding `status !== "active"`.
4. **SKUs for product P:** the winning level's entry for P; none → nothing. Query `skus where product = P` plus `id in entry.skus` if the list is non-empty, paginated.
5. Orgs/locations are free to pick any product (no subset-of-parent check).

**Deletes:**
- Deleting a product, client, organization or location deletes the catalog entries that reference it (`beforeDelete`, same transaction).
- Deleting a SKU is refused while any catalog entry lists it (`beforeDelete`), so a restricted list can never silently empty into "all SKUs".

## Tasks

### Phase 1: Data Layer

#### 1.1. [x] Create the `catalogEntries` collection
- **What:** New `src/collections/CatalogEntries.ts` exporting `CatalogEntries: CollectionConfig`, slug `catalogEntries`, labels "Catalog Entry" / "Catalog Entries":
  - `client`, `organization`, `location`: single relationships, not required. A shared `validate` on each (or one on `product`) returns an error unless exactly one owner is set ("Choose exactly one of client, organization or location").
  - `product`: relationship → `products`, required.
  - `skus`: relationship → `skus`, `hasMany`, label "SKUs", admin description "Leave empty to allow every SKU of the product.", `filterOptions: ({ data })` → `false` if no product, else `{ product: { equals: extractID(data.product) } }`. Changing the product with stale SKUs is rejected by the default relationship validator (no pruning hook).
  - `indexes`: unique `(client, product)`, `(organization, product)`, `(location, product)`. Add an app-level check in `product`'s `validate` (find another entry with the same owner + product, excluding `id`) for a friendly error; the index is the race-safe backstop.
  - `admin.defaultColumns`: `product`, `client`, `organization`, `location`.
  - Register in `src/payload.config.ts` as `withGroup(CatalogEntries, "Client")`.
- **Files:** `src/collections/CatalogEntries.ts`, `src/payload.config.ts`
- **Verify:** `pnpm generate:types` adds a `CatalogEntry` type; `pnpm exec tsc --noEmit` passes.

#### 1.2. [x] Replace the catalog group with join fields on Clients, Organizations, Locations
- **What:** Export `catalogEntriesField(on: "client" | "organization" | "location"): Field` from `common.ts` — a `join` named `catalogEntries`, label "SKU Catalog", `collection: "catalogEntries"`, `on`, admin description "Products and SKUs available here. Overrides the parent's catalog entirely; leave empty to inherit from the parent." Use it in each of the three collections in place of `catalogField`.
- **Replaces previous build:** remove `catalogField` from the `fields` arrays of `Clients.ts`, `Organizations.ts`, `Locations.ts` and its import.
- **Files:** `src/collections/common.ts`, `src/collections/Clients.ts`, `src/collections/Organizations.ts`, `src/collections/Locations.ts`
- **Verify:** `pnpm generate:types` shows `catalogEntries` join on all three and no `catalog` group; `pnpm exec tsc --noEmit` passes.

#### 1.3. [x] Delete hooks
- **What:**
  - `beforeDelete` (not `afterDelete`: the SQL adapter's single-relationship FKs are `ON DELETE SET NULL`, so after the delete the entries' owner/product is already null and can't be matched) on `products`, `clients`, `organizations`, `locations`: `req.payload.delete({ collection: "catalogEntries", where: { <field>: { equals: id } }, req })` — same transaction via `req`, so a failed delete rolls the entries back too. Put a small factory (e.g. `deleteCatalogEntriesOf(field)`) in `common.ts` and use it from each collection (`Products.ts` too).
  - `beforeDelete` on `skus`: `req.payload.count({ collection: "catalogEntries", where: { skus: { in: [id] } }, req })`; if > 0 throw `APIError` ("SKU is used by N catalog entries; remove it from them first", status 400).
- **Files:** `src/collections/common.ts`, `src/collections/Products.ts`, `src/collections/Clients.ts`, `src/collections/Organizations.ts`, `src/collections/Locations.ts`, `src/collections/Skus.ts`
- **Verify:** `pnpm exec tsc --noEmit`; behaviour checked in 1.5.

#### 1.4. [x] Cleanup: remove the old catalog group code
- **What:** Delete `catalogField` and `pruneCatalogSkus` from `common.ts` along with now-unused imports (`CatalogValue`, `pruneOrphanSkus`, `Relation`, `Client`/`Organization`/`Location` types, `FieldHook` if unused).
- **Files:** `src/collections/common.ts`
- **Verify:** `grep -rn "catalogField\|pruneCatalogSkus" src` returns no matches; `pnpm generate:types`, `pnpm exec tsc --noEmit` and `pnpm lint` pass.

#### 1.5. [x] Local API check
- **What:** Against a **copy** of the dev DB (`DATABASE_URL` pointed at the copy), with a scratch `tsx` script:
  - entry with zero or two owners → validation error; duplicate (location, product) → validation error;
  - entry whose `skus` belong to another product → validation error;
  - deleting a SKU listed by an entry → refused; deleting an unlisted SKU → succeeds;
  - deleting a location / product → its entries are gone.
- **Files:** none (scratch script outside the repo)
- **Verify:** all cases behave as described; schema push completes (dropping old `catalog` rels is expected).

### Phase 2: Resolver

#### 2.1. [x] Pure resolution helpers
- **What:** In `src/lib/catalog.ts`, pure DB-free functions:
  - `type CatalogSource = "location" | "organization" | "client"`; `type EntryIds = { product: number; skus: number[] }`; `toEntryIds(entry)` normalising a `CatalogEntry` (populated or ID values) via `extractID`.
  - `pickEffectiveLevel(levels: [CatalogSource, EntryIds[]][]): { source: CatalogSource; entries: EntryIds[] } | null` — first level (ordered location, org, client) with `entries.length > 0`, else `null`.
  - `skuWhereForEntry(entry: EntryIds): Where` — `{ product: { equals } }`, plus `id: { in: skus }` when `skus` is non-empty.
- **Replaces previous build:** delete `CatalogValue`, `CatalogIds`, `SkuFilter`, `toCatalogIds`, `pickEffectiveCatalog`, `skuFilterForProduct`, `pruneOrphanSkus`, `Relation` (if unused).
- **Files:** `src/lib/catalog.ts`
- **Verify:** `pnpm exec tsc --noEmit` passes.

#### 2.2. [x] Payload-backed resolver functions
- **What:** In the same file (optional `req` to share transactions):
  - `getLocationCatalog(payload, locationId)` — `findByID` location (`select: { organization: true }`), then organization (`select: { client: true }`); then one `payload.find` on `catalogEntries` where `or: [location = L, organization = O, client = C]`, `select: { client, organization, location, product, skus }`, `depth: 0`, `pagination: false`; group by level and return `pickEffectiveLevel(...)` as `{ source, entries }` (or `{ source: null, entries: [] }`).
  - `getAvailableProducts(payload, locationId)` — products where `id in entries' products` and `status equals "active"`, `pagination: false`.
  - `getAvailableSkus(payload, locationId, productId, { page, limit = 50 })` — empty page if the product isn't active or has no entry at the winning level; otherwise `payload.find` skus with `skuWhereForEntry(entry)`, paginated.
- **Replaces previous build:** rewrite the existing `getLocationCatalog` / `getAvailableProducts` / `getAvailableSkus` (no more catalog-wide SKU→product lookup query); keep `emptyPage`.
- **Files:** `src/lib/catalog.ts`
- **Verify:** `pnpm exec tsc --noEmit`; scratch `tsx` script against the DB copy for a location with its own entries, one inheriting from org, one from client, and an entry with/without `skus`.

#### 2.3. [x] Unit tests for resolution rules
- **What:** Rewrite tests for the pure helpers only (no DB):
  - location with entries overrides org and client (client has A, location has B → B only); empty location falls back to org, then client; all empty → `null`;
  - `toEntryIds` handles populated docs, raw IDs, `null`/`undefined` skus;
  - `skuWhereForEntry`: empty `skus` → product filter only; non-empty → product + `id in`.
- **Replaces previous build:** remove tests for `toCatalogIds`, `pickEffectiveCatalog`, `skuFilterForProduct`, `pruneOrphanSkus`.
- **Files:** `tests/int/catalog.int.spec.ts`
- **Verify:** `pnpm exec vitest run --config ./vitest.config.mts tests/int/catalog.int.spec.ts` passes.

## Notes

- **Why a separate collection:** catalogs can reach thousands of SKUs; a `hasMany` on the parent loads, renders and rewrites the whole list on every save. One entry per (owner, product) keeps edits small, gets the normal list view (filter, paginate, bulk ops) and makes per-product lookups indexed.
- **Why `skus` only (no mode / option values):** "pick by option values" or "exclude these" are UI conveniences that materialise into the `skus` list; storing just the list keeps one rule in the resolver. Trade-off: a filtered list doesn't auto-gain new matching SKUs (empty lists do). A `mode` / `optionValues` field can be added later without migrating.
- **Override is whole-level, not per-product.** If a location has any entry, it loses every client/org product — by design. Per-product override later = change `pickEffectiveLevel` only.
- **Statuses:** only product `status` is checked. Client/org/location `status` and SKU archiving are out of scope.
- **Out of scope:** the picker page (incl. option-based bulk SKU selection), API endpoints, storing a location's selections, access control changes, seed changes, data migration from the old `catalog` group, updating `IMPLEMENTATION.md`. Deleting an organization does not cascade to its locations (unchanged).
- **Leftover:** the dev DB `skus` table still has an orphaned `status` column from the reverted auto-SKU work; unrelated, but the next schema push may prompt about it.
- **2026-10-12 — Revision:** Moved catalogs from the `catalog` group field to a `catalogEntries` collection (owner, product, skus; empty = all), added cascade/guard delete hooks, cleared resolver/tests for rewrite and added cleanup task 1.4 for the old group code; renamed plan from `location-sku-catalog.md`.

## Completed

- **Date:** 2026-10-12
- **All tasks executed successfully:** yes
- **Files changed:**
  - `src/collections/CatalogEntries.ts` — new collection: one owner (client/organization/location), product, optional SKUs filtered to the product; owner and duplicate validation; unique (owner, product) indexes; admin descriptions on the collection, each owner field, product and SKUs ("Select a product first…")
  - `src/payload.config.ts` — registered `catalogEntries` in the "Client" group; enabled SQLite transactions (`transactionOptions: {}`) so delete hooks roll back with a failed delete
  - `src/collections/common.ts` — removed `catalogField` / `pruneCatalogSkus`; added `catalogEntriesField(on)` join and `deleteCatalogEntriesOf(field)` `beforeDelete` hook, which throws if the bulk delete reports errors
  - `src/collections/Clients.ts`, `Organizations.ts`, `Locations.ts` — "SKU Catalog" join field and cascade delete hook
  - `src/collections/Products.ts` — cascade delete hook
  - `src/collections/Skus.ts` — `beforeDelete` guard refusing to delete SKUs listed by an entry
  - `src/collections/ProductOptionValues.ts` — `beforeDelete` guard refusing to delete a value used by any SKU (otherwise the SKU silently loses that option)
  - `src/lib/catalog.ts` — pure helpers (`toEntryIds`, `pickEffectiveLevel`, `skuWhereForEntry`) and resolvers rewritten over entries (`getLocationCatalog` now returns `{ source, entries }`)
  - `src/payload-types.ts` — regenerated
  - `tests/int/catalog.int.spec.ts` — 7 tests for the new pure helpers
- **Deviations:** `pnpm exec tsc --noEmit` failed between Phase 1 and Phase 2 (the old resolver read the removed `catalog` group); green after Phase 2. Local API checks (1.5, 2.2) and a full CRUD pass over every collection were run with scratch scripts against a copy of the dev DB, not committed. Added after the build: admin descriptions, the error check in `deleteCatalogEntriesOf`, SQLite transactions and the option value delete guard (found by the CRUD pass: failed parent deletes were still removing catalog entries, and deleting a used option value left SKUs without that option). Hiding/disabling the other owner fields was tried and dropped in favour of descriptions + validation errors.
- **How to test:** `pnpm exec vitest run --config ./vitest.config.mts tests/int/catalog.int.spec.ts`. In admin, add entries from a Location's "SKU Catalog" tab; try deleting a SKU listed by an entry or an option value used by a SKU (both refused); try deleting an organization that still has locations (refused, and its catalog entries are kept).
- **Dev DB:** pushed. The first push added `payload_locked_documents_rels.catalog_entries_id` without its foreign key, which made every later startup fail rebuilding that table; fixed by dropping the (empty) table so Payload recreated it. The old `catalog` rows were dropped and need re-entering as entries.
- **Follow-up items:** deleting a product with options/SKUs, an option with values, an organization with locations or a client with organizations is refused with a raw `NOT NULL constraint failed` error (template behaviour; could get readable `beforeDelete` messages); full `pnpm test:int` not run (`api.int.spec.ts` uses the real dev DB); `IMPLEMENTATION.md` still describes the old `catalog` group; client/org/location `status` still ignored by the resolver.
