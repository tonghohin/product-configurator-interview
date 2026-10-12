import type {
	CollectionConfig,
	Field,
	RelationshipFieldSingleValidation,
} from "payload";
import { extractID, relationship } from "payload/shared";
import type { CatalogEntry } from "@/payload-types";

const ownerFields = ["client", "organization", "location"] as const;
type OwnerField = (typeof ownerFields)[number];

const setOwners = (data: Partial<CatalogEntry> | undefined): OwnerField[] =>
	ownerFields.filter((field) => data?.[field] != null);

/** An entry belongs to exactly one client, organization or location */
const validateOwner: RelationshipFieldSingleValidation = async (value, ctx) => {
	// Custom validate replaces the default, which also enforces filterOptions
	const defaultResult = await relationship(value, ctx);
	if (defaultResult !== true) return defaultResult;

	const owners = setOwners(ctx.data as Partial<CatalogEntry> | undefined);
	if (owners.length === 0 || (owners.length > 1 && value != null)) {
		return "Choose exactly one of client, organization or location";
	}
	return true;
};

/**
 * One entry per owner and product. The unique indexes enforce this too; this
 * check only gives a readable error.
 */
const validateProduct: RelationshipFieldSingleValidation = async (
	value,
	ctx,
) => {
	const defaultResult = await relationship(value, ctx);
	if (defaultResult !== true) return defaultResult;

	const { id, req } = ctx;
	const data = ctx.data as Partial<CatalogEntry> | undefined;
	const owners = setOwners(data);
	if (!data?.product || owners.length !== 1) return true; // reported elsewhere
	const [owner] = owners;
	const ownerValue = data[owner] as NonNullable<CatalogEntry[OwnerField]>;

	const { totalDocs } = await req.payload.count({
		collection: "catalogEntries",
		where: {
			[owner]: { equals: extractID(ownerValue) },
			product: { equals: extractID(data.product) },
			...(id !== undefined && { id: { not_equals: id } }),
		},
		req,
	});
	if (totalDocs > 0)
		return `This ${owner} already has an entry for this product`;

	return true;
};

const ownerDescriptions: Record<OwnerField, string> = {
	client:
		"Applies to every organization and location of this client that has no entries of its own.",
	organization:
		"Applies to every location of this organization that has no entries of its own. Overrides the client's entries.",
	location:
		"Applies to this location only. Overrides its organization's and client's entries.",
};

const ownerField = (name: OwnerField): Field => ({
	name,
	type: "relationship",
	relationTo: `${name}s` as "clients" | "organizations" | "locations",
	hasMany: false,
	validate: validateOwner,
	admin: {
		description: ownerDescriptions[name],
	},
});

export const CatalogEntries: CollectionConfig = {
	slug: "catalogEntries",
	labels: {
		singular: "Catalog Entry",
		plural: "Catalog Entries",
	},
	typescript: {
		interface: "CatalogEntry",
	},
	admin: {
		defaultColumns: ["product", "client", "organization", "location"],
		description:
			"A product, and optionally some of its SKUs, that a client, organization or location can choose from. Choose exactly one owner. A location uses its own entries if it has any, otherwise its organization's, otherwise its client's.",
	},
	indexes: ownerFields.map((owner) => ({
		fields: [owner, "product"],
		unique: true,
	})),
	fields: [
		...ownerFields.map(ownerField),
		{
			name: "product",
			type: "relationship",
			relationTo: "products",
			hasMany: false,
			required: true,
			validate: validateProduct,
			admin: {
				description: "Only active products are offered.",
			},
		},
		{
			name: "skus",
			label: "SKUs",
			type: "relationship",
			relationTo: "skus",
			hasMany: true,
			admin: {
				description:
					"Select a product first; only its SKUs can be chosen. Leave empty to allow every SKU of the product.",
			},
			filterOptions: ({ data }) => {
				if (!data?.product) return false;
				return { product: { equals: extractID(data.product) } };
			},
		},
	],
};
