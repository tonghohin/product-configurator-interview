/**
 * Client-safe picker logic: narrowing a product's option values down to one
 * SKU. No Payload runtime imports, so client components can use it.
 */

export type ConfigValue = { id: number; title: string };

export type ConfigOption = { id: number; title: string; values: ConfigValue[] };

export type ConfigSku = { id: number; valueIds: number[] };

/** A product's options and the SKUs a location may choose from */
export type ProductConfiguration = {
	options: ConfigOption[];
	skus: ConfigSku[];
};

export type SelectedSku = {
	id: number;
	productTitle: string;
	valueTitles: string[];
};

export const describeSku = (sku: SelectedSku): string =>
	`${sku.productTitle} — ${sku.valueTitles.join(" / ")}`;

/** Picked value IDs, indexed by option position; null means not picked yet */
export type Picks = (number | null)[];

/** SKUs whose values include every pick made so far */
export const matchingSkus = (skus: ConfigSku[], picks: Picks): ConfigSku[] =>
	skus.filter((sku) =>
		picks.every((pick) => pick == null || sku.valueIds.includes(pick)),
	);

/**
 * Values of `option` used by some SKU that matches the picks of the options
 * before it, so every offered value still leads to a SKU.
 */
export const availableValues = (
	option: ConfigOption,
	skus: ConfigSku[],
	picksBefore: Picks,
): ConfigValue[] => {
	const used = new Set(
		matchingSkus(skus, picksBefore).flatMap((sku) => sku.valueIds),
	);
	return option.values.filter((value) => used.has(value.id));
};

/** Sets the pick at `index` and clears the picks after it */
export const setPick = (
	picks: Picks,
	index: number,
	valueId: number | null,
): Picks => [
	...Array.from({ length: index }, (_, i) => picks[i] ?? null),
	valueId,
];

/** The SKU once every option has a pick, else null */
export const resolveSku = (
	options: ConfigOption[],
	skus: ConfigSku[],
	picks: Picks,
): ConfigSku | null => {
	const complete =
		options.length > 0 && options.every((_, index) => picks[index] != null);
	if (!complete) return null;
	return matchingSkus(skus, picks)[0] ?? null;
};
