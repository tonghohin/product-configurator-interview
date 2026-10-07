import type {
	CollectionConfig,
	RelationshipFieldManyValidation,
} from "payload";
import { extractID, relationship } from "payload/shared";
import type { Skus as Sku } from "@/payload-types";

const comboKey = (ids: number[]): string => [...ids].sort().join(",");

/**
 * A SKU must pick exactly one value for every option of its product, and no
 * other SKU of the same product may have the same combination.
 */
const validateOptionValues: RelationshipFieldManyValidation = async (
	value,
	ctx,
) => {
	// Custom validate replaces the default, which also enforces filterOptions
	const defaultResult = await relationship(value, ctx);
	if (defaultResult !== true) return defaultResult;

	const { id, req } = ctx;
	const data = ctx.data as Partial<Sku> | undefined;
	if (!data?.product) return true; // `product` reports its own required error
	const productId = extractID(data.product);

	const valueIds = (data.productOptionValues ?? []).map(extractID);
	if (valueIds.length === 0) return "Select a value for each product option";

	const [{ docs: productOptions }, { docs: optionValues }] = await Promise.all([
		req.payload.find({
			collection: "productOptions",
			where: { product: { equals: productId } },
			depth: 0,
			pagination: false,
			req,
		}),
		req.payload.find({
			collection: "productOptionValues",
			where: { id: { in: valueIds } },
			depth: 0,
			pagination: false,
			req,
		}),
	]);

	const optionTitleById = new Map(
		productOptions.map((option) => [String(option.id), option.title]),
	);
	const seenOptions = new Set<string>();
	for (const optionValue of optionValues) {
		const optionId = String(extractID(optionValue.productOption));
		if (!optionTitleById.has(optionId)) {
			return `"${optionValue.title}" does not belong to this SKU's product`;
		}
		if (seenOptions.has(optionId)) {
			return `Only one value can be selected for "${optionTitleById.get(optionId)}"`;
		}
		seenOptions.add(optionId);
	}

	const missing = [...optionTitleById]
		.filter(([optionId]) => !seenOptions.has(optionId))
		.map(([, title]) => `"${title}"`);
	if (missing.length > 0) return `Missing a value for ${missing.join(", ")}`;

	const { docs: siblingSkus } = await req.payload.find({
		collection: "skus",
		where: {
			product: { equals: productId },
			...(id !== undefined && { id: { not_equals: id } }),
		},
		depth: 0,
		pagination: false,
		select: { productOptionValues: true },
		req,
	});
	const key = comboKey(valueIds);
	const duplicate = siblingSkus.find(
		(sku) => comboKey((sku.productOptionValues ?? []).map(extractID)) === key,
	);
	if (duplicate) return `SKU ${duplicate.id} already has this combination`;

	return true;
};

export const Skus: CollectionConfig = {
	slug: "skus",
	labels: {
		plural: "SKUs",
		singular: "SKU",
	},
	fields: [
		{
			name: "product",
			type: "relationship",
			relationTo: "products",
			hasMany: false,
			required: true,
		},
		{
			name: "productOptionValues",
			type: "relationship",
			relationTo: "productOptionValues",
			hasMany: true,
			required: true,
			filterOptions: ({ data }) => {
				if (!data?.product) return false;
				return {
					"productOption.product": { equals: extractID(data.product) },
				};
			},
			validate: validateOptionValues,
		},
	],
};
