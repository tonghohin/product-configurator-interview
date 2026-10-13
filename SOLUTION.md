# Solution: Linking product catalogs to locations

This document covers what is built, how it works, why it works this way, and what it
doesn't do yet. Setup is unchanged from the [README](README.md).

## Summary

Admins decide which products, and optionally which SKUs of each product, a client,
organization or location can order. A location inherits its catalog from its organization,
which inherits from its client. A lower level can replace the catalog it would otherwise
inherit.

```
Client ──< Organization ──< Location
  │             │              │
  └─────────────┴──────────────┴──< Catalog Entry >── Product
                                         │
                                         └── SKUs (optional subset; empty = all)
```

A location's catalog comes from the **most specific level that has any entries**: the
location itself, then its organization, then its client.

## What is built

### Catalog Entries collection

[`src/collections/CatalogEntries.ts`](src/collections/CatalogEntries.ts) stores one document
per owner and product:

| Field | Notes |
| --- | --- |
| `client` / `organization` / `location` | Exactly one must be set. |
| `product` | Required. |
| `skus` | Optional. Leave it empty to allow every SKU of the product. The admin picker only offers SKUs of the selected product, and the server rejects SKUs from any other product. |

**Validation:**
- An entry with zero owners, or with more than one, is rejected.
- Each owner can have only one entry per product. A unique index on (owner, product) for
  each owner type enforces this. A validator in front of the index returns a readable error
  such as "This location already has an entry for this product".

**Admin:**
- Clients, organizations and locations have a **SKU Catalog** tab (a join field), where
  entries can be viewed and added.
- Products have an **Offered By** tab listing every entry that includes them.

### Catalog resolution

[`src/lib/catalog.ts`](src/lib/catalog.ts) answers the question "what can this location
order?":

- `getLocationCatalog(payload, locationId)` loads the location's organization and client,
  then fetches the entries for all three levels in a single query. It returns the entries
  of the most specific level that has any, and names that level (`location`,
  `organization`, `client` or `null`).
- `getAvailableProducts` returns the **active** products in that catalog.
- `getAvailableSkus` returns a page of a product's allowed SKUs.
- `getProductConfiguration` returns a product's options, limited to values that some
  allowed SKU actually uses, together with those SKUs. The order page uses it.
- `getAllowedSkus` splits a submitted list of SKU IDs into allowed and rejected. The server
  uses it to check orders.

The rules themselves (`pickEffectiveLevel`, `skuWhereForEntry`, `toEntryIds`) are pure
functions that are unit-tested on their own.

### Data integrity

Catalog entries depend on SKUs and option values being well formed, so those collections
have rules of their own:

- **SKUs** ([`Skus.ts`](src/collections/Skus.ts)) must have exactly one value for each of
  their product's options, all from that product. No two SKUs of a product can have the
  same combination.
- **Cascading deletes:** deleting a client, organization, location or product also deletes
  its catalog entries. This runs in `beforeDelete` because the SQL adapter nulls the foreign
  key once the row is gone.
- **Delete guards:**
  - A SKU listed by a catalog entry can't be deleted. Otherwise a restricted entry could
    silently empty out and become "every SKU".
  - An option value used by a SKU can't be deleted.
- **Transactions:** these are enabled for SQLite (`transactionOptions: {}`), so if a delete
  fails, the cascade rolls back with it.

### Order page

`/order` ([`src/app/(frontend)/order/`](src/app/(frontend)/order)) is a demo of the
catalog from the buyer's side:

1. Pick a client, then one of its active locations.
2. Pick a product, then one value per option. Each option only offers values that still
   lead to an allowed SKU, so the buyer never reaches a dead end.
3. Add the SKU to a list and repeat. The same SKU can't be added twice.
4. Submit. The server checks every SKU against the location's catalog again and shows which
   were confirmed and which were rejected. Nothing is saved.

The page requires login. Each server action checks for a user itself, because server
actions are public endpoints.

### Seed data

[`scripts/seed.ts`](scripts/seed.ts) can be run repeatedly; it only creates what is missing.
The catalog entries cover each rule:

| Scenario | Example |
| --- | --- |
| Client-wide catalog | Maple & Birch locations without their own entries |
| Location overrides client | Maple & Birch - Outlet Store 1 (Black flat-style T-shirts and the hoodie only) |
| Organization overrides client | Harbour St - Canada West (red T-shirts and adult caps only) |
| Location overrides organization | Harbour St - Victoria Inner Harbour (11oz mugs only) |
| SKU subset | Northern Peaks toques (black only) |
| No catalog at any level | Prairie Goods - Saskatchewan locations |
| Inactive product | Aurora Tote Bag is a draft, so Maple & Birch locations don't see it even though it is in their catalog |

### Tests

- [`tests/int/catalog.int.spec.ts`](tests/int/catalog.int.spec.ts) covers the resolution
  rules: overriding, falling back to a parent level, no catalog, and SKU filters.
- [`tests/int/configurator.int.spec.ts`](tests/int/configurator.int.spec.ts) covers the
  option picker: narrowing, hidden values, resolving a SKU, and clearing later picks.

Run them with `pnpm test:int`.

### Try it

1. Run `pnpm seed`.
2. In the admin, open **Client → Locations → Harbour St - Victoria Inner Harbour → SKU
   Catalog** to see a location-level override.
3. Open `/order`, choose Harbour St, and compare Victoria Inner Harbour with another
   Harbour St location.

## Why it works this way

**A separate collection, not a list field on each owner.** A catalog can grow to hundreds or
thousands of SKUs. As a `hasMany` field on a client, every save would load, render and
rewrite the whole list. With one document per (owner, product):
- edits stay small;
- admins get Payload's list view, with filtering, pagination and bulk actions;
- lookups by owner and product use an index;
- per-product data such as price or limits has a natural home later.

**Three owner fields, not one polymorphic `owner`.** Payload's SQL adapter stores
polymorphic relationships in a separate `_rels` table, which can't take part in a
collection index. Three plain relationship columns allow a real unique index on
(owner, product) for each level. Validation keeps exactly one of them set.

**Override, not merge.** If a level has any entries, it replaces its parent's catalog
completely. This is simple to understand: the catalog shown on a location's tab, or on the
nearest parent that has entries, is exactly what it gets. It also allows taking products
away, which merging can't do without an extra "exclude" concept. The resolver reports which
level the catalog came from, so the result is easy to explain.

**Only a SKU list, where empty means all.** An entry either allows every SKU of a product
(which also picks up new SKUs automatically) or lists exactly the allowed ones. An explicit list
is used instead of rules such as "only these option values" or "all except these":
- An explicit list can express any combination, such as "red only in the babydoll style".
  Per-option rules can't.
- The resolver has a single rule (`id in [...]`), so there are no rule semantics to
  misread.
- In a B2B setting, a new variant usually shouldn't appear at a client before someone
  approves it.

The cost is in the admin, not the model: building a long list by hand is slow (see the
limitations).

**Only active products are offered.** A product is withdrawn by setting it to draft or
archived. Its catalog entries are kept, so making it active again restores it everywhere.

**The picker gets its option values from the allowed SKUs.** It does not use the product's
full option list. As a result, a restricted catalog automatically hides values that have no
allowed SKU.

## Known limitations

### Admin usability

- **SKUs have no display name**, so the catalog entry's SKU picker shows IDs. A generated
  title such as "Moose T-Shirt — Black / Flat / Small" would fix this.
- **Building a SKU subset is manual.** Restricting a product to "everything except Large"
  means ticking each SKU. A custom field that selects SKUs by option value would make this
  quick, and would still store an explicit list.
- **Choosing an owner isn't guided.** All three owner fields are shown side by side, and only
  validation enforces that exactly one is set. An owner-type selector that shows only the
  relevant field would be clearer.

### Catalog model

- **An override replaces the parent's whole catalog.** Adding one product at a single
  location means copying all of its parent's entries to that location first. Overriding
  per product would only require changing `pickEffectiveLevel`.
- **A non-empty SKU list never picks up new SKUs.** Only "all SKUs" entries do. An "all
  except these" mode would cover this without giving up exact lists.
- **A child level isn't limited to its parent's catalog.** An organization can offer
  products its client doesn't.
- **Status checks are partial.** Only product status is checked. The resolver ignores the
  status of clients, organizations, locations and option values (the order page does hide
  inactive clients and locations), and SKUs have no status.

### Access and ordering

- **No per-client access control.** Any logged-in user can read every client's catalog.
  The order page's client dropdown stands in for client scoping; the server doesn't enforce
  it. Real scoping needs users linked to clients, plus access rules.
- **Orders aren't saved**, and there are no quantities or prices. Submitting only checks
  the selection.
- **Minor order-page issues:**
  - Changing the location clears the list without asking.
  - The submitted result lists option values in stored order, not option order.

### Engineering

- **Tests are unit tests only.** There are no database-backed tests for validation, the
  delete hooks or `getLocationCatalog`, and no end-to-end test of `/order`.
- **Some deletes fail with raw errors.** Deleting a parent that still has children (such as
  an organization with locations, or a product with SKUs) fails with a raw `NOT NULL`
  constraint error instead of a readable message. This is the template's existing
  behaviour.
- **No migrations.** The schema relies on SQLite schema push in development, so a
  production deployment would need migrations generated first.
