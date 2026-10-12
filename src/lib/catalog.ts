import type { PaginatedDocs, Payload, PayloadRequest, Where } from "payload";
import { extractID } from "payload/shared";
import type { CatalogEntry, Product, Skus as Sku } from "@/payload-types";

export type CatalogSource = "location" | "organization" | "client";

/** A catalog entry reduced to IDs; empty `skus` means every SKU of the product */
export type EntryIds = { product: number; skus: number[] };

export type LocationCatalog = {
	source: CatalogSource | null;
	entries: EntryIds[];
};

export const toEntryIds = (
	entry: Pick<CatalogEntry, "product" | "skus">,
): EntryIds => ({
	product: extractID(entry.product),
	skus: (entry.skus ?? []).map(extractID),
});

/**
 * Levels are ordered most specific first (location, organization, client).
 * The first level with any entries wins outright; levels are never merged.
 */
export const pickEffectiveLevel = (
	levels: [CatalogSource, EntryIds[]][],
): { source: CatalogSource; entries: EntryIds[] } | null => {
	const level = levels.find(([, entries]) => entries.length > 0);
	return level ? { source: level[0], entries: level[1] } : null;
};

/** The SKUs an entry allows: all of its product's, or only the listed ones */
export const skuWhereForEntry = (entry: EntryIds): Where => ({
	product: { equals: entry.product },
	...(entry.skus.length > 0 && { id: { in: entry.skus } }),
});

type ResolverOptions = { req?: PayloadRequest };

/** The catalog a location resolves to: its own, else its org's, else its client's */
export const getLocationCatalog = async (
	payload: Payload,
	locationId: number,
	{ req }: ResolverOptions = {},
): Promise<LocationCatalog> => {
	const location = await payload.findByID({
		collection: "locations",
		id: locationId,
		select: { organization: true },
		depth: 0,
		req,
	});
	const organizationId = extractID(location.organization);
	const organization = await payload.findByID({
		collection: "organizations",
		id: organizationId,
		select: { client: true },
		depth: 0,
		req,
	});
	const clientId = extractID(organization.client);

	const { docs } = await payload.find({
		collection: "catalogEntries",
		where: {
			or: [
				{ location: { equals: locationId } },
				{ organization: { equals: organizationId } },
				{ client: { equals: clientId } },
			],
		},
		select: {
			client: true,
			organization: true,
			location: true,
			product: true,
			skus: true,
		},
		depth: 0,
		pagination: false,
		req,
	});

	const entriesOf = (source: CatalogSource) =>
		docs.filter((entry) => entry[source] != null).map(toEntryIds);
	const effective = pickEffectiveLevel([
		["location", entriesOf("location")],
		["organization", entriesOf("organization")],
		["client", entriesOf("client")],
	]);
	return effective ?? { source: null, entries: [] };
};

/** Active products a location can choose from */
export const getAvailableProducts = async (
	payload: Payload,
	locationId: number,
	{ req }: ResolverOptions = {},
): Promise<Product[]> => {
	const { entries } = await getLocationCatalog(payload, locationId, { req });
	if (entries.length === 0) return [];

	const { docs } = await payload.find({
		collection: "products",
		where: {
			id: { in: entries.map((entry) => entry.product) },
			status: { equals: "active" },
		},
		depth: 0,
		pagination: false,
		req,
	});
	return docs;
};

const emptyPage = <T>(limit: number): PaginatedDocs<T> => ({
	docs: [],
	hasNextPage: false,
	hasPrevPage: false,
	limit,
	nextPage: null,
	page: 1,
	pagingCounter: 1,
	prevPage: null,
	totalDocs: 0,
	totalPages: 1,
});

/** One page of the SKUs of a product that a location can choose from */
export const getAvailableSkus = async (
	payload: Payload,
	locationId: number,
	productId: number,
	{
		page = 1,
		limit = 50,
		req,
	}: ResolverOptions & {
		page?: number;
		limit?: number;
	} = {},
): Promise<PaginatedDocs<Sku>> => {
	const [{ entries }, product] = await Promise.all([
		getLocationCatalog(payload, locationId, { req }),
		payload.findByID({
			collection: "products",
			id: productId,
			select: { status: true },
			depth: 0,
			disableErrors: true,
			req,
		}),
	]);
	const entry = entries.find((candidate) => candidate.product === productId);
	if (!entry || product?.status !== "active") return emptyPage(limit);

	return payload.find({
		collection: "skus",
		where: skuWhereForEntry(entry),
		depth: 0,
		page,
		limit,
		req,
	});
};
