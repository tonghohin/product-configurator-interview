import path from "node:path";
import { fileURLToPath } from "node:url";
import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig, type CollectionConfig } from "payload";
import sharp from "sharp";

// Collections
import { CatalogEntries } from "./collections/CatalogEntries";
import { Clients } from "./collections/Clients";
import { Locations } from "./collections/Locations";
import { Media } from "./collections/Media";
import { Organizations } from "./collections/Organizations";
import { ProductOptions } from "./collections/ProductOptions";
import { ProductOptionValues } from "./collections/ProductOptionValues";
import { Products } from "./collections/Products";
import { Skus } from "./collections/Skus";
import { Users } from "./collections/Users";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const withGroup = (
	collection: CollectionConfig,
	group: string,
): CollectionConfig => ({
	...collection,
	admin: { ...collection.admin, group },
});

export default buildConfig({
	admin: {
		user: Users.slug,
		importMap: {
			baseDir: path.resolve(dirname),
		},
	},
	collections: [
		withGroup(Users, "System"),
		withGroup(Media, "System"),
		withGroup(Clients, "Client"),
		withGroup(Organizations, "Client"),
		withGroup(Locations, "Client"),
		withGroup(CatalogEntries, "Client"),
		withGroup(Products, "Product"),
		withGroup(ProductOptions, "Product"),
		withGroup(ProductOptionValues, "Product"),
		withGroup(Skus, "Product"),
	],
	editor: lexicalEditor(),
	secret: process.env.PAYLOAD_SECRET || "",
	typescript: {
		outputFile: path.resolve(dirname, "payload-types.ts"),
	},
	db: sqliteAdapter({
		client: {
			url: process.env.DATABASE_URL || "",
		},
		transactionOptions: {},
	}),
	sharp,
	plugins: [],
});
