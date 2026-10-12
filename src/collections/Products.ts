import type { CollectionConfig } from "payload";
import {
	deleteCatalogEntriesOf,
	generalStatusField,
	handleField,
	titleField,
} from "./common";

export const Products: CollectionConfig = {
	slug: "products",
	admin: {
		useAsTitle: "title",
	},
	hooks: {
		beforeDelete: [deleteCatalogEntriesOf("product")],
	},
	fields: [
		handleField,
		titleField,
		generalStatusField,
		{
			name: "attributes",
			type: "json",
			required: true,
			defaultValue: {},
			validate: (_val) => {
				return true;
			},
		},
		{
			name: "options",
			type: "join",
			collection: "productOptions",
			on: "product",
		},
		{
			name: "skus",
			type: "join",
			collection: "skus",
			on: "product",
		},
		{
			name: "catalogEntries",
			label: "Offered By",
			type: "join",
			collection: "catalogEntries",
			on: "product",
			admin: {
				defaultColumns: ["client", "organization", "location", "skus"],
				description:
					"Clients, organizations and locations whose catalog includes this product.",
			},
		},
	],
};
