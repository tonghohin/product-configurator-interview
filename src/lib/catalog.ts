import type { PaginatedDocs, Payload, PayloadRequest, Where } from "payload";
import { extractID } from "payload/shared";
import type { Product, Skus as Sku } from "@/payload-types";

export type Relation = number | { id: number };

/** A `catalog` group as stored on clients, organizations and locations */
export type CatalogValue =
	| {
			products?: Relation[] | null;
			skus?: Relation[] | null;
	  }
	| null
	| undefined;

export type CatalogIds = { products: number[]; skus: number[] };

export type SkuFilter =
	| { kind: "none" }
	| { kind: "all" }
	| { kind: "only"; skuIds: number[] };

export const toCatalogIds = (catalog: CatalogValue): CatalogIds => ({
	products: (catalog?.products ?? []).map(extractID),
	skus: (catalog?.skus ?? []).map(extractID),
});

/**
 * Levels are ordered most specific first (location, organization, client).
 * The first level with any products wins outright; levels are never merged.
 */
export const pickEffectiveCatalog = (levels: CatalogIds[]): CatalogIds | null =>
	levels.find((level) => level.products.length > 0) ?? null;

/**
 * Which SKUs of a product are allowed: none if the product isn't in the
 * catalog, only the listed ones if any of its SKUs are listed, otherwise all.
 */
export const skuFilterForProduct = (
	catalog: CatalogIds,
	productId: number,
	skuProductById: Map<number, number>,
): SkuFilter => {
	if (!catalog.products.includes(productId)) return { kind: "none" };
	const skuIds = catalog.skus.filter(
		(skuId) => skuProductById.get(skuId) === productId,
	);
	return skuIds.length > 0 ? { kind: "only", skuIds } : { kind: "all" };
};

/** Drops SKUs whose product is no longer in the catalog, keeping order */
export const pruneOrphanSkus = (
	skuIds: number[],
	productIds: number[],
	skuProductById: Map<number, number>,
): number[] => {
	const allowed = new Set(productIds);
	return skuIds.filter((skuId) => {
		const productId = skuProductById.get(skuId);
		return productId !== undefined && allowed.has(productId);
	});
};

export type CatalogSource = "location" | "organization" | "client";

export type LocationCatalog = {
	catalog: CatalogIds | null;
	source: CatalogSource | null;
};

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
		select: { catalog: true, organization: true },
		depth: 0,
		req,
	});
	const organization = await payload.findByID({
		collection: "organizations",
		id: extractID(location.organization),
		select: { catalog: true, client: true },
		depth: 0,
		req,
	});
	const client = await payload.findByID({
		collection: "clients",
		id: extractID(organization.client),
		select: { catalog: true },
		depth: 0,
		req,
	});

	const levels: [CatalogSource, CatalogIds][] = [
		["location", toCatalogIds(location.catalog)],
		["organization", toCatalogIds(organization.catalog)],
		["client", toCatalogIds(client.catalog)],
	];
	const catalog = pickEffectiveCatalog(levels.map(([, ids]) => ids));
	const source = levels.find(([, ids]) => ids === catalog)?.[0] ?? null;
	return { catalog, source };
};

/** Active products a location can choose from */
export const getAvailableProducts = async (
	payload: Payload,
	locationId: number,
	{ req }: ResolverOptions = {},
): Promise<Product[]> => {
	const { catalog } = await getLocationCatalog(payload, locationId, { req });
	if (!catalog) return [];

	const { docs } = await payload.find({
		collection: "products",
		where: {
			id: { in: catalog.products },
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
	const { catalog } = await getLocationCatalog(payload, locationId, { req });
	if (!catalog) return emptyPage(limit);

	const [product, { docs: catalogSkus }] = await Promise.all([
		payload.findByID({
			collection: "products",
			id: productId,
			select: { status: true },
			depth: 0,
			disableErrors: true,
			req,
		}),
		payload.find({
			collection: "skus",
			where: { id: { in: catalog.skus } },
			select: { product: true },
			depth: 0,
			pagination: false,
			req,
		}),
	]);
	if (product?.status !== "active") return emptyPage(limit);

	const filter = skuFilterForProduct(
		catalog,
		productId,
		new Map(catalogSkus.map((sku) => [sku.id, extractID(sku.product)])),
	);
	if (filter.kind === "none") return emptyPage(limit);

	const where: Where = { product: { equals: productId } };
	if (filter.kind === "only") where.id = { in: filter.skuIds };

	return payload.find({
		collection: "skus",
		where,
		depth: 0,
		page,
		limit,
		req,
	});
};
