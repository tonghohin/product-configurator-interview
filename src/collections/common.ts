import type { Field, FieldHook, TextFieldSingleValidation } from "payload";
import { extractID } from "payload/shared";
import {
	type CatalogValue,
	pruneOrphanSkus,
	type Relation,
} from "@/lib/catalog";
import type { Client, Location, Organization } from "@/payload-types";

const handlePattern = /^[a-zA-Z0-9-]+$/;

const handleValidation: TextFieldSingleValidation = async (
	handle: string | null | undefined,
) => {
	if (handle === undefined || handle === null) return "Handle must be provided";
	if (handlePattern.exec(handle)) return true;
	return "Invalid characters in handle";
};

export const handleField: Field = {
	name: "handle",
	type: "text",
	unique: true,
	required: true,
	validate: handleValidation,
};

export const titleField: Field = {
	name: "title",
	type: "text",
	required: true,
};

export const generalStatusField: Field = {
	name: "status",
	type: "select",
	hasMany: false,
	options: ["draft", "active", "archived"],
	defaultValue: "active",
	required: true,
};

/**
 * Runs before validation so SKUs of a removed product are dropped instead of
 * failing the relationship filterOptions check.
 */
const pruneCatalogSkus: FieldHook<
	Client | Organization | Location,
	Relation[] | null | undefined,
	NonNullable<CatalogValue>
> = async ({ value, siblingData, req }) => {
	if (!value?.length) return value;
	const skuIds = value.map(extractID);
	const { docs } = await req.payload.find({
		collection: "skus",
		where: { id: { in: skuIds } },
		select: { product: true },
		depth: 0,
		pagination: false,
		req,
	});
	const skuProductById = new Map(
		docs.map((sku) => [sku.id, extractID(sku.product)]),
	);
	return pruneOrphanSkus(
		skuIds,
		(siblingData.products ?? []).map(extractID),
		skuProductById,
	);
};

export const catalogField: Field = {
	name: "catalog",
	label: "SKU Catalog",
	type: "group",
	admin: {
		description:
			"Products and SKUs available here. Overrides the parent's catalog entirely; leave empty to inherit from the parent.",
	},
	fields: [
		{
			name: "products",
			type: "relationship",
			relationTo: "products",
			hasMany: true,
		},
		{
			name: "skus",
			label: "SKUs",
			type: "relationship",
			relationTo: "skus",
			hasMany: true,
			admin: {
				description:
					"Leave empty to allow every SKU of the selected products. Listing SKUs of a product restricts that product to those SKUs.",
			},
			filterOptions: ({ siblingData }) => {
				const products = (siblingData as NonNullable<CatalogValue>)?.products;
				if (!products?.length) return false;
				return { product: { in: products.map(extractID) } };
			},
			hooks: {
				beforeValidate: [pruneCatalogSkus],
			},
		},
	],
};
