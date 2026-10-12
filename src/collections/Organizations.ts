import type { CollectionConfig } from "payload";
import {
	catalogEntriesField,
	deleteCatalogEntriesOf,
	generalStatusField,
	handleField,
	titleField,
} from "./common";

export const Organizations: CollectionConfig = {
	slug: "organizations",
	admin: {
		useAsTitle: "title",
	},
	hooks: {
		beforeDelete: [deleteCatalogEntriesOf("organization")],
	},
	fields: [
		generalStatusField,
		handleField,
		titleField,
		{
			name: "client",
			label: "Client of Organization",
			type: "relationship",
			relationTo: "clients",
			required: true,
		},
		{
			name: "locations",
			type: "join",
			collection: "locations",
			on: "organization",
		},
		catalogEntriesField("organization"),
	],
};
