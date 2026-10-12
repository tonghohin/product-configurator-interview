import { describe, expect, it } from "vitest";
import {
	availableValues,
	type ConfigOption,
	type ConfigSku,
	matchingSkus,
	resolveSku,
	setPick,
} from "@/lib/configurator";

const size: ConfigOption = {
	id: 1,
	title: "Size",
	values: [
		{ id: 10, title: "Small" },
		{ id: 11, title: "Large" },
	],
};
const colour: ConfigOption = {
	id: 2,
	title: "Colour",
	values: [
		{ id: 20, title: "Red" },
		{ id: 21, title: "Black" },
		{ id: 22, title: "White" },
	],
};
const options = [size, colour];

// Large only comes in Black; White has no SKU at all
const skus: ConfigSku[] = [
	{ id: 100, valueIds: [10, 20] },
	{ id: 101, valueIds: [10, 21] },
	{ id: 102, valueIds: [21, 11] },
];

describe("matchingSkus", () => {
	it("keeps SKUs containing every pick, ignoring unpicked options", () => {
		expect(matchingSkus(skus, []).map((sku) => sku.id)).toEqual([
			100, 101, 102,
		]);
		expect(matchingSkus(skus, [10, null]).map((sku) => sku.id)).toEqual([
			100, 101,
		]);
		expect(matchingSkus(skus, [11, 21]).map((sku) => sku.id)).toEqual([102]);
	});
});

describe("availableValues", () => {
	it("offers only values used by some SKU", () => {
		expect(availableValues(colour, skus, []).map((v) => v.title)).toEqual([
			"Red",
			"Black",
		]);
	});

	it("narrows by the picks of earlier options", () => {
		expect(availableValues(colour, skus, [11]).map((v) => v.title)).toEqual([
			"Black",
		]);
		expect(availableValues(colour, skus, [10]).map((v) => v.title)).toEqual([
			"Red",
			"Black",
		]);
	});

	it("offers nothing when no SKUs are allowed", () => {
		expect(availableValues(size, [], [])).toEqual([]);
	});
});

describe("setPick", () => {
	it("sets the pick and clears later ones", () => {
		expect(setPick([10, 20], 0, 11)).toEqual([11]);
		expect(setPick([10], 1, 21)).toEqual([10, 21]);
		expect(setPick([10, 21], 1, null)).toEqual([10, null]);
	});

	it("pads skipped positions with null", () => {
		expect(setPick([], 1, 21)).toEqual([null, 21]);
	});
});

describe("resolveSku", () => {
	it("is null until every option is picked", () => {
		expect(resolveSku(options, skus, [])).toBeNull();
		expect(resolveSku(options, skus, [10])).toBeNull();
		expect(resolveSku(options, skus, [10, null])).toBeNull();
	});

	it("returns the SKU matching the full combination", () => {
		expect(resolveSku(options, skus, [10, 21])?.id).toBe(101);
		expect(resolveSku(options, skus, [11, 21])?.id).toBe(102);
	});

	it("is null for a combination without a SKU or a product without options", () => {
		expect(resolveSku(options, skus, [11, 20])).toBeNull();
		expect(resolveSku([], skus, [])).toBeNull();
	});
});
