import { describe, expect, it } from "vitest";
import {
	type EntryIds,
	pickEffectiveLevel,
	skuWhereForEntry,
	toEntryIds,
} from "@/lib/catalog";

describe("toEntryIds", () => {
	it("handles raw ids and populated docs", () => {
		expect(
			toEntryIds({
				product: { id: 1 } as never,
				skus: [{ id: 10 } as never, 11],
			}),
		).toEqual({ product: 1, skus: [10, 11] });
		expect(toEntryIds({ product: 2, skus: [20] })).toEqual({
			product: 2,
			skus: [20],
		});
	});

	it("treats missing skus as empty", () => {
		expect(toEntryIds({ product: 1, skus: null })).toEqual({
			product: 1,
			skus: [],
		});
		expect(toEntryIds({ product: 1 })).toEqual({ product: 1, skus: [] });
	});
});

describe("pickEffectiveLevel", () => {
	const client: EntryIds[] = [{ product: 1, skus: [] }];
	const organization: EntryIds[] = [
		{ product: 1, skus: [10] },
		{ product: 2, skus: [] },
	];
	const location: EntryIds[] = [{ product: 2, skus: [] }];

	it("location overrides organization and client entirely", () => {
		expect(
			pickEffectiveLevel([
				["location", location],
				["organization", organization],
				["client", client],
			]),
		).toEqual({ source: "location", entries: location });
	});

	it("falls back to organization, then client", () => {
		expect(
			pickEffectiveLevel([
				["location", []],
				["organization", organization],
				["client", client],
			]),
		).toEqual({ source: "organization", entries: organization });
		expect(
			pickEffectiveLevel([
				["location", []],
				["organization", []],
				["client", client],
			]),
		).toEqual({ source: "client", entries: client });
	});

	it("returns null when no level has entries", () => {
		expect(
			pickEffectiveLevel([
				["location", []],
				["organization", []],
				["client", []],
			]),
		).toBeNull();
	});
});

describe("skuWhereForEntry", () => {
	it("allows every SKU of the product when none are listed", () => {
		expect(skuWhereForEntry({ product: 1, skus: [] })).toEqual({
			product: { equals: 1 },
		});
	});

	it("restricts to the listed SKUs", () => {
		expect(skuWhereForEntry({ product: 1, skus: [10, 11] })).toEqual({
			product: { equals: 1 },
			id: { in: [10, 11] },
		});
	});
});
