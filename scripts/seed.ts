import { type CollectionSlug, getPayload } from "payload";
import config from "../src/payload.config.js";
import "dotenv/config";

/**
 * Seed data below mirrors the sample records in example.db (clients,
 * organizations, locations, products, productOptions, productOptionValues,
 * skus), plus extra dummy records and catalog entries. Users and media are
 * intentionally omitted — see the seed plan for why.
 */

const clientsData = [
	{
		handle: "maple-birch",
		title: "Maple & Birch",
		status: "active",
		legal_name: "Maple & Birch Trading Co.",
		legal_address: "123 Maple Ave, Birch, ON, Canada",
	},
	{
		handle: "harbor",
		title: "Harbour St Outfitters",
		status: "active",
		legal_name: "Harbour Street Outfitters Inc.",
		legal_address: "111 Harbour St, Townsville, BC, Canada",
	},
	{
		handle: "northern-peaks",
		title: "Northern Peaks Coffee",
		status: "active",
		legal_name: "Northern Peaks Coffee Roasters Ltd.",
		legal_address: "400 Summit Rd, Calgary, AB, Canada",
	},
	{
		handle: "prairie-goods",
		title: "Prairie Goods Co.",
		status: "active",
		legal_name: "Prairie Goods Cooperative",
		legal_address: "88 Wheatfield Ave, Winnipeg, MB, Canada",
	},
	{
		handle: "old-port",
		title: "Old Port Provisions",
		status: "draft",
		legal_name: "Old Port Provisions S.E.N.C.",
		legal_address: "15 Rue du Port, Montréal, QC, Canada",
	},
] as const;

const organizationsData = [
	{
		handle: "maple-birch-ca",
		title: "Maple & Birch - Canada Wide",
		status: "active",
		clientHandle: "maple-birch",
	},
	{
		handle: "harbour-st-west",
		title: "Harbour St - Canada West",
		status: "active",
		clientHandle: "harbor",
	},
	{
		handle: "harbour-st-east",
		title: "Harbour St - Canada East",
		status: "active",
		clientHandle: "harbor",
	},
	{
		handle: "northern-peaks-ab",
		title: "Northern Peaks - Alberta",
		status: "active",
		clientHandle: "northern-peaks",
	},
	{
		handle: "prairie-goods-mb",
		title: "Prairie Goods - Manitoba",
		status: "active",
		clientHandle: "prairie-goods",
	},
	{
		handle: "prairie-goods-sk",
		title: "Prairie Goods - Saskatchewan",
		status: "active",
		clientHandle: "prairie-goods",
	},
	{
		handle: "old-port-qc",
		title: "Old Port - Québec",
		status: "draft",
		clientHandle: "old-port",
	},
] as const;

const locationsData = [
	{
		title: "Maple & Birch - Flagship Store",
		status: "active",
		organizationHandle: "maple-birch-ca",
		address: "123 Maple St, Birch, ON, Canada",
	},
	{
		title: "Maple & Birch - Outlet Store 1",
		status: "active",
		organizationHandle: "maple-birch-ca",
		address: "312 Outlet Dr, Vaughan, ON, Canada",
	},
	{
		title: "Harbour St - Vancouver Mall",
		status: "active",
		organizationHandle: "harbour-st-west",
		address: "2 Mall St, Vancouver, BC, Canada",
	},
	{
		title: "Harbour St - Outlet Store",
		status: "active",
		organizationHandle: "harbour-st-east",
		address: "312 Outlet Dr, Vaughan, ON, Canada",
	},
	{
		title: "Harbour St - Victoria Inner Harbour",
		status: "active",
		organizationHandle: "harbour-st-west",
		address: "9 Wharf St, Victoria, BC, Canada",
	},
	{
		title: "Northern Peaks - Calgary Roastery",
		status: "active",
		organizationHandle: "northern-peaks-ab",
		address: "400 Summit Rd, Calgary, AB, Canada",
	},
	{
		title: "Northern Peaks - Banff Café",
		status: "active",
		organizationHandle: "northern-peaks-ab",
		address: "201 Banff Ave, Banff, AB, Canada",
	},
	{
		title: "Northern Peaks - Edmonton Downtown",
		status: "archived",
		organizationHandle: "northern-peaks-ab",
		address: "10155 Jasper Ave, Edmonton, AB, Canada",
	},
	{
		title: "Prairie Goods - Exchange District",
		status: "active",
		organizationHandle: "prairie-goods-mb",
		address: "70 Albert St, Winnipeg, MB, Canada",
	},
	{
		title: "Prairie Goods - Broadway Saskatoon",
		status: "active",
		organizationHandle: "prairie-goods-sk",
		address: "620 Broadway Ave, Saskatoon, SK, Canada",
	},
	{
		title: "Prairie Goods - Regina Cathedral",
		status: "active",
		organizationHandle: "prairie-goods-sk",
		address: "2900 13th Ave, Regina, SK, Canada",
	},
	{
		title: "Old Port - Vieux-Montréal",
		status: "draft",
		organizationHandle: "old-port-qc",
		address: "15 Rue du Port, Montréal, QC, Canada",
	},
] as const;

const productsData = [
	{
		handle: "moose-tshirt",
		title: "Moose T-Shirt",
		status: "active",
		attributes: {},
	},
] as const;

const productOptionsData = [
	{
		handle: "moose-tshirt-colour",
		title: "Colour",
		status: "active",
		productHandle: "moose-tshirt",
	},
	{
		handle: "moose-tshirt-style",
		title: "Style",
		status: "active",
		productHandle: "moose-tshirt",
	},
	{
		handle: "moose-tshirt-size",
		title: "Size",
		status: "active",
		productHandle: "moose-tshirt",
	},
] as const;

const productOptionValuesData = [
	{
		handle: "moose-tshirt-size-s",
		title: "Small",
		status: "active",
		optionHandle: "moose-tshirt-size",
	},
	{
		handle: "moose-tshirt-size-m",
		title: "Medium",
		status: "active",
		optionHandle: "moose-tshirt-size",
	},
	{
		handle: "moose-tshirt-size-l",
		title: "Large",
		status: "active",
		optionHandle: "moose-tshirt-size",
	},
	{
		handle: "moose-tshirt-style-flat",
		title: "Flat",
		status: "active",
		optionHandle: "moose-tshirt-style",
	},
	{
		handle: "moose-tshirt-colour-black",
		title: "Black",
		status: "active",
		optionHandle: "moose-tshirt-colour",
	},
	{
		handle: "moose-tshirt-colour-red",
		title: "Red",
		status: "active",
		optionHandle: "moose-tshirt-colour",
	},
	{
		handle: "moose-tshirt-style-babydoll",
		title: "Babydoll",
		status: "active",
		optionHandle: "moose-tshirt-style",
	},
] as const;

const skusData = [
	{
		productHandle: "moose-tshirt",
		optionValueHandles: [
			"moose-tshirt-size-s",
			"moose-tshirt-style-flat",
			"moose-tshirt-colour-black",
		],
	},
	{
		productHandle: "moose-tshirt",
		optionValueHandles: [
			"moose-tshirt-size-m",
			"moose-tshirt-style-flat",
			"moose-tshirt-colour-black",
		],
	},
	{
		productHandle: "moose-tshirt",
		optionValueHandles: [
			"moose-tshirt-size-l",
			"moose-tshirt-style-flat",
			"moose-tshirt-colour-black",
		],
	},
	{
		productHandle: "moose-tshirt",
		optionValueHandles: [
			"moose-tshirt-size-s",
			"moose-tshirt-style-flat",
			"moose-tshirt-colour-red",
		],
	},
	{
		productHandle: "moose-tshirt",
		optionValueHandles: [
			"moose-tshirt-size-m",
			"moose-tshirt-style-flat",
			"moose-tshirt-colour-red",
		],
	},
	{
		productHandle: "moose-tshirt",
		optionValueHandles: [
			"moose-tshirt-size-l",
			"moose-tshirt-style-flat",
			"moose-tshirt-colour-red",
		],
	},
	{
		productHandle: "moose-tshirt",
		optionValueHandles: [
			"moose-tshirt-size-s",
			"moose-tshirt-style-babydoll",
			"moose-tshirt-colour-black",
		],
	},
	{
		productHandle: "moose-tshirt",
		optionValueHandles: [
			"moose-tshirt-size-m",
			"moose-tshirt-style-babydoll",
			"moose-tshirt-colour-black",
		],
	},
	{
		productHandle: "moose-tshirt",
		optionValueHandles: [
			"moose-tshirt-size-l",
			"moose-tshirt-style-babydoll",
			"moose-tshirt-colour-black",
		],
	},
	{
		productHandle: "moose-tshirt",
		optionValueHandles: [
			"moose-tshirt-size-s",
			"moose-tshirt-style-babydoll",
			"moose-tshirt-colour-red",
		],
	},
	{
		productHandle: "moose-tshirt",
		optionValueHandles: [
			"moose-tshirt-size-m",
			"moose-tshirt-style-babydoll",
			"moose-tshirt-colour-red",
		],
	},
	{
		productHandle: "moose-tshirt",
		optionValueHandles: [
			"moose-tshirt-size-l",
			"moose-tshirt-style-babydoll",
			"moose-tshirt-colour-red",
		],
	},
] as const;

type GeneratedProduct = {
	handle: string;
	title: string;
	status: "draft" | "active" | "archived";
	attributes: Record<string, unknown>;
	/** Option key → value key → title; handles are derived from the keys */
	options: { key: string; title: string; values: Record<string, string> }[];
	/** Value-key combos (in option order) left without a SKU */
	excludeCombos?: string[][];
};

/** SKUs are every combination of option values minus `excludeCombos` */
const generatedProducts: GeneratedProduct[] = [
	{
		handle: "loon-hoodie",
		title: "Loon Hoodie",
		status: "active",
		attributes: { material: "80% cotton, 20% polyester", weight_gsm: 320 },
		options: [
			{
				key: "colour",
				title: "Colour",
				values: {
					forest: "Forest Green",
					heather: "Heather Grey",
					navy: "Navy",
				},
			},
			{
				key: "size",
				title: "Size",
				values: { s: "Small", m: "Medium", l: "Large", xl: "X-Large" },
			},
		],
		// Navy hasn't come in X-Large
		excludeCombos: [["navy", "xl"]],
	},
	{
		handle: "canoe-mug",
		title: "Canoe Mug",
		status: "active",
		attributes: { material: "Stoneware", dishwasher_safe: true },
		options: [
			{
				key: "size",
				title: "Size",
				values: { "11oz": "11 oz", "15oz": "15 oz" },
			},
			{
				key: "finish",
				title: "Finish",
				values: { gloss: "Gloss", matte: "Matte" },
			},
		],
	},
	{
		handle: "northern-toque",
		title: "Northern Toque",
		status: "active",
		attributes: { material: "Merino wool" },
		options: [
			{
				key: "colour",
				title: "Colour",
				values: { red: "Red", black: "Black", cream: "Cream" },
			},
		],
	},
	{
		handle: "maple-cap",
		title: "Maple Leaf Cap",
		status: "active",
		attributes: { closure: "Snapback" },
		options: [
			{
				key: "colour",
				title: "Colour",
				values: { khaki: "Khaki", black: "Black" },
			},
			{ key: "fit", title: "Fit", values: { youth: "Youth", adult: "Adult" } },
			{
				key: "patch",
				title: "Patch",
				values: { leather: "Leather", embroidered: "Embroidered" },
			},
		],
		// Leather patch is adult-only
		excludeCombos: [
			["khaki", "youth", "leather"],
			["black", "youth", "leather"],
		],
	},
	{
		handle: "aurora-tote",
		title: "Aurora Tote Bag",
		status: "draft",
		attributes: { material: "Canvas" },
		options: [
			{
				key: "print",
				title: "Print",
				values: { aurora: "Aurora", lake: "Lake" },
			},
		],
	},
];

const cartesian = (lists: string[][]): string[][] =>
	lists.reduce<string[][]>(
		(combos, list) => combos.flatMap((combo) => list.map((v) => [...combo, v])),
		[[]],
	);

const allProductsData = [
	...productsData,
	...generatedProducts.map(({ handle, title, status, attributes }) => ({
		handle,
		title,
		status,
		attributes,
	})),
];

const allProductOptionsData = [
	...productOptionsData,
	...generatedProducts.flatMap((product) =>
		product.options.map((option) => ({
			handle: `${product.handle}-${option.key}`,
			title: option.title,
			status: "active" as const,
			productHandle: product.handle,
		})),
	),
];

const allProductOptionValuesData = [
	...productOptionValuesData,
	...generatedProducts.flatMap((product) =>
		product.options.flatMap((option) =>
			Object.entries(option.values).map(([key, title]) => ({
				handle: `${product.handle}-${option.key}-${key}`,
				title,
				status: "active" as const,
				optionHandle: `${product.handle}-${option.key}`,
			})),
		),
	),
];

const allSkusData = [
	...skusData,
	...generatedProducts.flatMap((product) => {
		const excluded = new Set(
			(product.excludeCombos ?? []).map((combo) => combo.join("|")),
		);
		return cartesian(
			product.options.map((option) => Object.keys(option.values)),
		)
			.filter((combo) => !excluded.has(combo.join("|")))
			.map((combo) => ({
				productHandle: product.handle,
				optionValueHandles: combo.map(
					(key, i) => `${product.handle}-${product.options[i].key}-${key}`,
				),
			}));
	}),
];

type CatalogEntrySeed = {
	/** Exactly one owner: client/organization by handle, location by title */
	owner: { client: string } | { organization: string } | { location: string };
	productHandle: string;
	/** Option value handles a SKU must all have; omit to allow every SKU */
	skuValueHandles?: string[];
};

/**
 * Covers the inheritance rules: client catalogs, organization and location
 * overrides, SKU subsets, a draft product, and an organization (Prairie Goods
 * Saskatchewan) whose locations resolve to no catalog at all.
 */
const catalogEntriesData: CatalogEntrySeed[] = [
	// Maple & Birch: client-wide; the Outlet Store overrides with its own
	{ owner: { client: "maple-birch" }, productHandle: "moose-tshirt" },
	{ owner: { client: "maple-birch" }, productHandle: "canoe-mug" },
	{ owner: { client: "maple-birch" }, productHandle: "northern-toque" },
	{ owner: { client: "maple-birch" }, productHandle: "aurora-tote" },
	{
		owner: { location: "Maple & Birch - Outlet Store 1" },
		productHandle: "moose-tshirt",
		skuValueHandles: ["moose-tshirt-colour-black", "moose-tshirt-style-flat"],
	},
	{
		owner: { location: "Maple & Birch - Outlet Store 1" },
		productHandle: "loon-hoodie",
	},

	// Harbour St: client-wide; Canada West overrides; Victoria overrides West
	{ owner: { client: "harbor" }, productHandle: "loon-hoodie" },
	{ owner: { client: "harbor" }, productHandle: "maple-cap" },
	{
		owner: { organization: "harbour-st-west" },
		productHandle: "moose-tshirt",
		skuValueHandles: ["moose-tshirt-colour-red"],
	},
	{
		owner: { organization: "harbour-st-west" },
		productHandle: "maple-cap",
		skuValueHandles: ["maple-cap-fit-adult"],
	},
	{
		owner: { location: "Harbour St - Victoria Inner Harbour" },
		productHandle: "canoe-mug",
		skuValueHandles: ["canoe-mug-size-11oz"],
	},

	// Northern Peaks: client-wide; Banff Café overrides
	{ owner: { client: "northern-peaks" }, productHandle: "canoe-mug" },
	{
		owner: { client: "northern-peaks" },
		productHandle: "northern-toque",
		skuValueHandles: ["northern-toque-colour-black"],
	},
	{
		owner: { location: "Northern Peaks - Banff Café" },
		productHandle: "canoe-mug",
		skuValueHandles: ["canoe-mug-finish-matte"],
	},
	{
		owner: { location: "Northern Peaks - Banff Café" },
		productHandle: "northern-toque",
	},

	// Prairie Goods: Manitoba only, no client-wide catalog
	{
		owner: { organization: "prairie-goods-mb" },
		productHandle: "northern-toque",
	},
	{
		owner: { organization: "prairie-goods-mb" },
		productHandle: "loon-hoodie",
		skuValueHandles: ["loon-hoodie-colour-forest"],
	},
];

async function seed(): Promise<void> {
	const payload = await getPayload({ config });

	// Re-runnable: existing records are matched and reused instead of duplicated
	const summary: Record<string, { created: number; existing: number }> = {};
	const findOrCreate = async (
		collection: Extract<
			CollectionSlug,
			| "clients"
			| "organizations"
			| "locations"
			| "products"
			| "productOptions"
			| "productOptionValues"
		>,
		match: { field: string; value: string },
		data: Record<string, unknown>,
	): Promise<number> => {
		summary[collection] ??= { created: 0, existing: 0 };
		const { docs } = await payload.find({
			collection,
			where: { [match.field]: { equals: match.value } },
			limit: 1,
			depth: 0,
		});
		if (docs[0]) {
			summary[collection].existing++;
			return docs[0].id as number;
		}
		const doc = await payload.create({ collection, data: data as never });
		summary[collection].created++;
		return doc.id as number;
	};

	// Clients
	const clientIdByHandle = new Map<string, number>();
	for (const client of clientsData) {
		const { handle, title, status, legal_name, legal_address } = client;
		const id = await findOrCreate(
			"clients",
			{ field: "handle", value: handle },
			{ handle, title, status, legal_name, legal_address },
		);
		clientIdByHandle.set(handle, id);
	}

	// Organizations
	const organizationIdByHandle = new Map<string, number>();
	for (const organization of organizationsData) {
		const { handle, title, status, clientHandle } = organization;
		const clientId = clientIdByHandle.get(clientHandle);
		if (!clientId) {
			throw new Error(`Unknown client handle: ${clientHandle}`);
		}
		const id = await findOrCreate(
			"organizations",
			{ field: "handle", value: handle },
			{ handle, title, status, client: clientId },
		);
		organizationIdByHandle.set(handle, id);
	}

	// Locations have no handle, so they're matched by title
	const locationIdByTitle = new Map<string, number>();
	for (const location of locationsData) {
		const { title, status, organizationHandle, address } = location;
		const organizationId = organizationIdByHandle.get(organizationHandle);
		if (!organizationId) {
			throw new Error(`Unknown organization handle: ${organizationHandle}`);
		}
		const id = await findOrCreate(
			"locations",
			{ field: "title", value: title },
			{ title, status, organization: organizationId, address },
		);
		locationIdByTitle.set(title, id);
	}

	// Products
	const productIdByHandle = new Map<string, number>();
	for (const product of allProductsData) {
		const { handle, title, status, attributes } = product;
		const id = await findOrCreate(
			"products",
			{ field: "handle", value: handle },
			{ handle, title, status, attributes },
		);
		productIdByHandle.set(handle, id);
	}

	// Product options
	const productOptionIdByHandle = new Map<string, number>();
	for (const productOption of allProductOptionsData) {
		const { handle, title, status, productHandle } = productOption;
		const productId = productIdByHandle.get(productHandle);
		if (!productId) {
			throw new Error(`Unknown product handle: ${productHandle}`);
		}
		const id = await findOrCreate(
			"productOptions",
			{ field: "handle", value: handle },
			{ handle, title, status, product: productId },
		);
		productOptionIdByHandle.set(handle, id);
	}

	// Product option values
	const productOptionValueIdByHandle = new Map<string, number>();
	for (const productOptionValue of allProductOptionValuesData) {
		const { handle, title, status, optionHandle } = productOptionValue;
		const productOptionId = productOptionIdByHandle.get(optionHandle);
		if (!productOptionId) {
			throw new Error(`Unknown product option handle: ${optionHandle}`);
		}
		const id = await findOrCreate(
			"productOptionValues",
			{ field: "handle", value: handle },
			{ handle, title, status, productOption: productOptionId },
		);
		productOptionValueIdByHandle.set(handle, id);
	}

	// SKUs are matched by their option value combination
	const comboKey = (ids: number[]): string => [...ids].sort().join(",");
	const { docs: existingSkus } = await payload.find({
		collection: "skus",
		depth: 0,
		pagination: false,
	});
	const existingCombos = new Set(
		existingSkus.map((sku) =>
			comboKey(
				(sku.productOptionValues ?? []).map((value) =>
					typeof value === "number" ? value : value.id,
				),
			),
		),
	);
	summary.skus = { created: 0, existing: 0 };
	for (const sku of allSkusData) {
		const productId = productIdByHandle.get(sku.productHandle);
		if (!productId) {
			throw new Error(`Unknown product handle: ${sku.productHandle}`);
		}
		const optionValueIds = sku.optionValueHandles.map((handle) => {
			const id = productOptionValueIdByHandle.get(handle);
			if (!id) {
				throw new Error(`Unknown product option value handle: ${handle}`);
			}
			return id;
		});
		if (existingCombos.has(comboKey(optionValueIds))) {
			summary.skus.existing++;
			continue;
		}
		await payload.create({
			collection: "skus",
			data: { product: productId, productOptionValues: optionValueIds },
		});
		summary.skus.created++;
	}

	// Catalog entries are matched by owner and product
	const { docs: allSkus } = await payload.find({
		collection: "skus",
		depth: 0,
		pagination: false,
	});
	const ownerIdMaps = {
		client: clientIdByHandle,
		organization: organizationIdByHandle,
		location: locationIdByTitle,
	};
	summary.catalogEntries = { created: 0, existing: 0 };
	for (const entry of catalogEntriesData) {
		const [[ownerField, ownerKey]] = Object.entries(entry.owner) as [
			keyof typeof ownerIdMaps,
			string,
		][];
		const ownerId = ownerIdMaps[ownerField].get(ownerKey);
		if (!ownerId) {
			throw new Error(`Unknown ${ownerField}: ${ownerKey}`);
		}
		const productId = productIdByHandle.get(entry.productHandle);
		if (!productId) {
			throw new Error(`Unknown product handle: ${entry.productHandle}`);
		}

		const { totalDocs } = await payload.count({
			collection: "catalogEntries",
			where: {
				[ownerField]: { equals: ownerId },
				product: { equals: productId },
			},
		});
		if (totalDocs > 0) {
			summary.catalogEntries.existing++;
			continue;
		}

		const requiredValueIds = (entry.skuValueHandles ?? []).map((handle) => {
			const id = productOptionValueIdByHandle.get(handle);
			if (!id) {
				throw new Error(`Unknown product option value handle: ${handle}`);
			}
			return id;
		});
		const skuIds =
			requiredValueIds.length > 0
				? allSkus
						.filter((sku) => {
							const valueIds = (sku.productOptionValues ?? []).map((value) =>
								typeof value === "number" ? value : value.id,
							);
							return (
								(typeof sku.product === "number"
									? sku.product
									: sku.product.id) === productId &&
								requiredValueIds.every((id) => valueIds.includes(id))
							);
						})
						.map((sku) => sku.id)
				: [];
		if (requiredValueIds.length > 0 && skuIds.length === 0) {
			throw new Error(
				`No SKUs of ${entry.productHandle} match ${entry.skuValueHandles?.join(", ")}`,
			);
		}

		await payload.create({
			collection: "catalogEntries",
			data: { [ownerField]: ownerId, product: productId, skus: skuIds },
		});
		summary.catalogEntries.created++;
	}

	console.log("Seed complete:");
	for (const [collection, { created, existing }] of Object.entries(summary)) {
		console.log(`  ${collection}: ${created} created, ${existing} existing`);
	}

	process.exit(0);
}

seed().catch((error) => {
	console.error("Seed failed:", error);
	process.exit(1);
});
