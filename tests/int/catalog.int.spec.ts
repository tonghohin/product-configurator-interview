import { describe, expect, it } from "vitest";
import {
	type CatalogIds,
	pickEffectiveCatalog,
	pruneOrphanSkus,
	skuFilterForProduct,
	toCatalogIds,
} from "@/lib/catalog";

const empty: CatalogIds = { products: [], skus: [] };

// SKU id -> product id
const skuProductById = new Map([
	[10, 1],
	[11, 1],
	[20, 2],
	[21, 2],
]);

describe("toCatalogIds", () => {
	it("handles raw ids and populated docs", () => {
		expect(
			toCatalogIds({ products: [1, { id: 2 }], skus: [{ id: 10 }, 20] }),
		).toEqual({ products: [1, 2], skus: [10, 20] });
	});

	it("treats missing values as empty", () => {
		expect(toCatalogIds(null)).toEqual(empty);
		expect(toCatalogIds(undefined)).toEqual(empty);
		expect(toCatalogIds({ products: null, skus: null })).toEqual(empty);
	});
});

describe("pickEffectiveCatalog", () => {
	const client: CatalogIds = { products: [1], skus: [] };
	const organization: CatalogIds = { products: [1, 2], skus: [10] };
	const location: CatalogIds = { products: [2], skus: [] };

	it("location overrides organization and client entirely", () => {
		expect(pickEffectiveCatalog([location, organization, client])).toBe(
			location,
		);
	});

	it("falls back to organization, then client", () => {
		expect(pickEffectiveCatalog([empty, organization, client])).toBe(
			organization,
		);
		expect(pickEffectiveCatalog([empty, empty, client])).toBe(client);
	});

	it("returns null when no level has products", () => {
		expect(pickEffectiveCatalog([empty, empty, empty])).toBeNull();
	});

	it("ignores a level with skus but no products", () => {
		expect(
			pickEffectiveCatalog([{ products: [], skus: [10] }, empty, client]),
		).toBe(client);
	});
});

describe("skuFilterForProduct", () => {
	const catalog: CatalogIds = { products: [1, 2], skus: [10, 20] };

	it("allows nothing for a product outside the catalog", () => {
		expect(skuFilterForProduct(catalog, 3, skuProductById)).toEqual({
			kind: "none",
		});
	});

	it("restricts to the listed SKUs of that product only", () => {
		expect(skuFilterForProduct(catalog, 1, skuProductById)).toEqual({
			kind: "only",
			skuIds: [10],
		});
	});

	it("allows all SKUs when none of the product's SKUs are listed", () => {
		expect(
			skuFilterForProduct({ products: [1, 2], skus: [20] }, 1, skuProductById),
		).toEqual({ kind: "all" });
	});
});

describe("pruneOrphanSkus", () => {
	it("drops SKUs of removed products and keeps order", () => {
		expect(pruneOrphanSkus([21, 10, 20, 11], [2], skuProductById)).toEqual([
			21, 20,
		]);
	});

	it("drops SKUs that no longer exist", () => {
		expect(pruneOrphanSkus([99, 10], [1], skuProductById)).toEqual([10]);
	});

	it("returns nothing when no products are selected", () => {
		expect(pruneOrphanSkus([10, 20], [], skuProductById)).toEqual([]);
	});
});
